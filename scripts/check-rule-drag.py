import http.client
import json
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path

addon_id = 'github-account-switcher@a4180p.github.io'
uuid = '91d602ab-82d0-4e9b-bf2c-d7a19b2b0a91'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
def request(method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=30)
    try:
        connection.request(method, path, body, {'Content-Type': 'application/json'})
        response = connection.getresponse()
        value = json.loads(response.read())
        if response.status >= 400:
            raise RuntimeError(value)
        return value['value']
    finally:
        connection.close()


with tempfile.TemporaryDirectory(prefix='firefox-rule-drag-') as folder:
    log_path = Path(folder) / 'driver.log'
    with log_path.open('w') as log:
        driver_path = shutil.which('geckodriver')
        assert driver_path, 'Install geckodriver to run this Firefox UI check'
        driver = subprocess.Popen([driver_path, '--host', '127.0.0.1', '--port', str(port),
                                   '--profile-root', folder, '--allow-system-access'], stdout=log, stderr=subprocess.STDOUT)
        session_id = None
        try:
            for _ in range(100):
                try:
                    request('GET', '/status')
                    break
                except OSError:
                    time.sleep(.1)
            session = request('POST', '/session', {'capabilities': {'alwaysMatch': {
                'browserName': 'firefox',
                'moz:firefoxOptions': {'args': ['-headless'], 'prefs': {
                    'extensions.webextensions.uuids': json.dumps({addon_id: uuid}),
                    'browser.startup.homepage': 'about:blank',
                }},
            }}})
            session_id = session['sessionId']
            prefix = '/session/' + session_id

            def execute(script):
                return request('POST', prefix + '/execute/sync', {'script': script, 'args': []})

            def asynchronous(script):
                return request('POST', prefix + '/execute/async', {'script': script, 'args': []})

            def wait(script):
                for _ in range(100):
                    result = execute(script)
                    if result:
                        return result
                    time.sleep(.1)
                raise AssertionError('Timed out waiting for the rules UI')

            print('Firefox:', session['capabilities']['browserVersion'])
            installed = request('POST', prefix + '/moz/addon/install', {
                'path': str(Path('release/firefox-unsigned.xpi').resolve()), 'temporary': True,
            })
            assert installed == addon_id
            request('POST', prefix + '/moz/context', {'context': 'chrome'})
            execute('''const policy=WebExtensionPolicy.getByID('github-account-switcher@a4180p.github.io');
              gBrowser.selectedBrowser.loadURI(Services.io.newURI(policy.getURL('popup.html')), {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
              }); return true;''')
            request('POST', prefix + '/moz/context', {'context': 'content'})
            wait('return document.querySelectorAll("[role=tab]").length > 0')
            result = asynchronous('''const done=arguments[arguments.length-1];
              window.browser.storage.local.set({accounts:{},rules:[
                {id:1,urlPattern:'/first/.+',account:'first_account'},
                {id:2,urlPattern:'/second/.+',account:'second_account'}
              ]}).then(()=>done(true),e=>done(String(e)));''')
            assert result is True, result
            execute('''Array.from(document.querySelectorAll('[role=tab]'))
              .find(el=>el.textContent.includes('Auto Switch Rules')).click(); return true;''')
            wait('return document.querySelectorAll("[draggable=true]").length === 2')
            coordinates = execute('''return Array.from(document.querySelectorAll('[draggable=true]'))
              .map(el=>{const r=el.getBoundingClientRect();
                return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};});''')
            execute('''window.dragEvents=[];
              for(const type of ['dragstart','dragend','dragover','drop'])
                document.addEventListener(type,e=>queueMicrotask(()=>window.dragEvents.push({
                  type,target:e.target.tagName,classes:e.target.getAttribute('class'),
                  prevented:e.defaultPrevented,effect:e.dataTransfer?.dropEffect
                })),true);
              return true;''')
            start, end = coordinates
            request('POST', prefix + '/actions', {'actions': [{
                'type': 'pointer', 'id': 'mouse', 'parameters': {'pointerType': 'mouse'},
                'actions': [
                    {'type': 'pointerMove', 'origin': 'viewport', **start, 'duration': 0},
                    {'type': 'pointerDown', 'button': 0}, {'type': 'pause', 'duration': 200},
                    {'type': 'pointerMove', 'origin': 'viewport', **end, 'duration': 800},
                    {'type': 'pause', 'duration': 300}, {'type': 'pointerUp', 'button': 0},
                ],
            }]})
            time.sleep(.5)
            print('Drag events:', execute('return window.dragEvents'))
            print('Row input values:', execute('return Array.from(document.querySelectorAll("input")).map(el=>el.value)'))
            stored = asynchronous('''const done=arguments[arguments.length-1];
              window.browser.storage.local.get('rules').then(v=>done(v.rules.map(r=>r.id)));''')
            print('Stored rule IDs:', stored)
            if stored != [2, 1]:
                request('POST', prefix + '/actions', {'actions': [{
                    'type': 'key', 'id': 'keyboard', 'actions': [
                        {'type': 'keyDown', 'value': chr(0xE00C)},
                        {'type': 'keyUp', 'value': chr(0xE00C)},
                    ],
                }]})
                execute('''window.controlDrop=false;
                  const source=document.createElement('div'), target=document.createElement('div');
                  source.draggable=true;
                  source.style.cssText='position:fixed;top:0;left:0;width:60px;height:30px;background:red;z-index:99999';
                  target.style.cssText='position:fixed;top:0;left:120px;width:60px;height:30px;background:blue;z-index:99999';
                  source.ondragstart=e=>{e.dataTransfer.setData('text/plain','control');e.dataTransfer.effectAllowed='move';};
                  target.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
                  target.ondrop=e=>{e.preventDefault();window.controlDrop=true;};
                  document.body.append(source,target);return true;''')
                request('POST', prefix + '/actions', {'actions': [{
                    'type': 'pointer', 'id': 'mouse', 'parameters': {'pointerType': 'mouse'},
                    'actions': [
                        {'type': 'pointerMove', 'origin': 'viewport', 'x': 30, 'y': 15, 'duration': 0},
                        {'type': 'pointerDown', 'button': 0}, {'type': 'pause', 'duration': 200},
                        {'type': 'pointerMove', 'origin': 'viewport', 'x': 150, 'y': 15, 'duration': 800},
                        {'type': 'pause', 'duration': 300}, {'type': 'pointerUp', 'button': 0},
                    ],
                }]})
                time.sleep(.5)
                print('Plain HTML control drop:', execute('return window.controlDrop'))
                print('Control drag events:', execute('return window.dragEvents.slice(-10)'))
            assert stored == [2, 1], 'Dragging did not persist the new rule order'
            request('POST', prefix + '/refresh', {})
            wait('return document.querySelectorAll("[role=tab]").length > 0')
            stored = asynchronous('''const done=arguments[arguments.length-1];
              window.browser.storage.local.get('rules').then(v=>done(v.rules.map(r=>r.id)));''')
            assert stored == [2, 1], 'Reordered rules were not saved'
            print('Firefox rule drag and persistence OK')
        finally:
            if session_id:
                try:
                    request('DELETE', '/session/' + session_id)
                except Exception as error:
                    print('WebDriver cleanup failed:', error)
            else:
                log.flush()
                print(log_path.read_text()[-6000:])
            driver.terminate()
            driver.wait(timeout=10)
