import Reguest from './utils/reguest'
import Storage from './core/storage/storage'
import Base64 from './utils/base64'
import Settings from './interaction/settings/api'
import Modal from './interaction/modal'
import Input from './interaction/settings/input'
import Controller from './core/controller'
import Noty from './interaction/noty'
import Utils from './utils/utils'

let origin = 'http://127.0.0.1:8080'
let network = new Reguest()
let component = 'local_sync'
let refs = {
    status: null,
    login: null,
    logout: null,
    clear: null
}
let refresh_promise = null

function rootUrl(path = ''){
    return origin + (path ? '/' + path.replace(/^\//,'') : '')
}

function accessToken(){
    return (Storage.get('sync_access_token', '') || '') + ''
}

function refreshToken(){
    return (Storage.get('sync_refresh_token', '') || '') + ''
}

function decodeBase64Url(value){
    value = (value || '').replace(/-/g, '+').replace(/_/g, '/')

    while(value.length % 4) value += '='

    return Base64.decode(value)
}

function parseAccessToken(token = accessToken()){
    try{
        let payload = (token || '').split('.')[1]

        if(!payload) return null

        return JSON.parse(decodeBase64Url(payload))
    }
    catch(e){
        return null
    }
}

function status(){
    let token  = accessToken()
    let claims = parseAccessToken(token)
    let exp    = claims && claims.exp ? claims.exp * 1000 : 0
    let now    = Date.now()

    return {
        access_token: token,
        refresh_token: refreshToken(),
        claims,
        user_id: claims && claims.sub ? claims.sub : '',
        exp,
        logged_in: Boolean(token && claims && claims.sub),
        expired: Boolean(exp && exp <= now)
    }
}

function hasSession(){
    return Boolean(accessToken() || refreshToken())
}

function hasRefreshToken(){
    return Boolean(refreshToken())
}

function tokenNeedsRefresh(){
    let info = status()

    if(!info.access_token || !info.logged_in) return hasRefreshToken()

    return !info.exp || info.exp <= Date.now() + 60 * 1000
}

function setTokens(data = {}){
    Storage.set('sync_access_token', data.access_token || '', true)
    Storage.set('sync_refresh_token', data.refresh_token || '', true)

    draw()
}

function clearTokens(){
    Storage.set('sync_access_token', '', true)
    Storage.set('sync_refresh_token', '', true)

    draw()
}

function authRequest(path, payload = {}){
    return new Promise((resolve, reject)=>{
        network.silent(rootUrl('api/auth/' + path.replace(/^\//,'')), resolve, reject, JSON.stringify(payload), {
            timeout: 5000,
            dataType: 'json',
            headers: {
                'Content-Type': 'application/json'
            }
        })
    })
}

function refresh(){
    if(refresh_promise) return refresh_promise

    let token = refreshToken()

    if(!token){
        clearTokens()

        return Promise.reject({status: 401})
    }

    refresh_promise = authRequest('refresh', {
        refresh_token: token
    }).then((response)=>{
        setTokens(response)

        return response
    }).catch((error)=>{
        clearTokens()

        throw error
    }).finally(()=>{
        refresh_promise = null
    })

    return refresh_promise
}

function ensureAccessToken(){
    let info = status()

    if(info.logged_in && !tokenNeedsRefresh()) return Promise.resolve(info.access_token)

    if(hasRefreshToken()){
        return refresh().then((response)=>response.access_token || accessToken())
    }

    return Promise.reject({status: 401})
}

function restore(){
    if(!hasSession()) return Promise.resolve(false)

    if(!tokenNeedsRefresh()) return Promise.resolve(true)

    return refresh().then(()=>true).catch(()=>false)
}

function logout(){
    let token = refreshToken()

    if(!token){
        clearTokens()
        return Promise.resolve()
    }

    return authRequest('logout', {
        refresh_token: token
    }).catch(()=>{}).finally(()=>{
        clearTokens()
    })
}

function describeStatus(){
    let info = status()

    if(info.logged_in && !info.expired){
        return {
            value: info.user_id,
            descr: 'Access token expires: ' + new Date(info.exp).toLocaleString()
        }
    }

    if(info.logged_in && info.expired){
        return {
            value: info.user_id,
            descr: 'Access token expired' + (info.refresh_token ? ', refresh is available' : '')
        }
    }

    if(info.refresh_token){
        return {
            value: 'Session expired',
            descr: 'Use Login to get a new access token'
        }
    }

    return {
        value: 'Not logged in',
        descr: 'Login stores only access and refresh tokens'
    }
}

function draw(){
    let info = describeStatus()
    let current = status()

    if(refs.status && refs.status.length){
        refs.status.find('.settings-param__value').text(info.value)
        refs.status.find('.settings-param__descr').text(info.descr)
    }

    if(refs.login && refs.login.length){
        refs.login.toggleClass('hide', current.logged_in && !current.expired)
    }

    if(refs.logout && refs.logout.length){
        refs.logout.toggleClass('hide', !hasSession())
    }

    if(refs.clear && refs.clear.length){
        refs.clear.toggleClass('hide', !hasSession())
    }
}

function updateForm(form, model){
    form.find('[data-field="user_id"] .settings-param__value').text(model.user_id || 'Tap to enter user ID')
    form.find('[data-field="password"] .settings-param__value').text(model.password ? '********' : 'Tap to enter password')
    form.find('.sync-auth-form__status').text(model.status || 'Enter user ID and password')
}

function openLoginModal(){
    let previous = Controller.enabled().name
    let model = {
        user_id: '',
        password: '',
        status: ''
    }

    let form = $(`
        <div class="about">
            <div class="settings-param selector" data-field="user_id">
                <div class="settings-param__name">User ID</div>
                <div class="settings-param__value"></div>
            </div>
            <div class="settings-param selector" data-field="password">
                <div class="settings-param__name">Password</div>
                <div class="settings-param__value"></div>
            </div>
            <div class="settings-param selector settings-param--button" data-action="submit">
                <div class="settings-param__name">Login</div>
            </div>
            <div class="settings-param__descr sync-auth-form__status" style="margin-top:1em"></div>
        </div>
    `)

    let close = ()=>{
        Modal.close()
        Controller.toggle(previous)
    }

    let submit = ()=>{
        if(!model.user_id || !model.password){
            model.status = 'User ID and password are required'
            updateForm(form, model)

            return
        }

        model.status = 'Signing in...'
        updateForm(form, model)

        authRequest('login', {
            user_id: model.user_id,
            password: model.password
        }).then((response)=>{
            model.password = ''

            setTokens(response)
            Noty.show('Local Sync login successful')

            close()
        }).catch((error)=>{
            model.status = error && error.status == 401 ? 'Invalid user ID or password' : 'Login failed'
            updateForm(form, model)
        })
    }

    form.find('[data-field="user_id"]').on('hover:enter', ()=>{
        Input.edit({
            title: 'User ID',
            value: model.user_id,
            nosave: true,
            controller: 'modal'
        }, (value)=>{
            model.user_id = (value || '').trim()
            updateForm(form, model)
        })
    })

    form.find('[data-field="password"]').on('hover:enter', ()=>{
        Input.edit({
            title: 'Password',
            value: model.password,
            password: true,
            nosave: true,
            controller: 'modal'
        }, (value)=>{
            model.password = value || ''
            updateForm(form, model)
        })
    })

    form.find('[data-action="submit"]').on('hover:enter', submit)

    updateForm(form, model)

    Modal.open({
        title: 'Local Sync Login',
        html: form,
        size: 'small',
        onBack: close
    })
}

function initSettings(){
    let icon = `<svg width="37" height="37" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="33" height="33" rx="6" stroke="white" stroke-width="3"/>
        <path d="M11 13.5H26" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M11 18.5H26" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M11 23.5H20" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <circle cx="25" cy="24" r="4" fill="white"/>
    </svg>`

    Settings.addComponent({
        component,
        icon,
        name: 'Local Sync',
        after: 'tmdb'
    })

    Settings.addParam({
        component,
        param: {
            type: 'static'
        },
        field: {
            name: 'Status'
        },
        onRender: (item)=>{
            refs.status = item

            if(!item.find('.settings-param__value').length){
                item.append('<div class="settings-param__value"></div>')
            }

            if(!item.find('.settings-param__descr').length){
                item.append('<div class="settings-param__descr"></div>')
            }

            draw()
        }
    })

    Settings.addParam({
        component,
        param: {
            type: 'button'
        },
        field: {
            name: 'Login'
        },
        onRender: (item)=>{
            refs.login = item
            draw()
        },
        onChange: openLoginModal
    })

    Settings.addParam({
        component,
        param: {
            type: 'button'
        },
        field: {
            name: 'Logout'
        },
        onRender: (item)=>{
            refs.logout = item
            draw()
        },
        onChange: ()=>{
            logout().then(()=>{
                Noty.show('Local Sync logout complete')
            })
        }
    })

    Settings.addParam({
        component,
        param: {
            type: 'button'
        },
        field: {
            name: 'Clear Tokens'
        },
        onRender: (item)=>{
            refs.clear = item
            draw()
        },
        onChange: ()=>{
            clearTokens()
            Noty.show('Local Sync tokens cleared')
        }
    })
}

function init(){
    initSettings()

    Storage.listener.follow('change', (event)=>{
        if(event.name == 'sync_access_token' || event.name == 'sync_refresh_token') draw()
    })
}

export default {
    init: Utils.onceInit(init),
    status,
    hasSession,
    hasRefreshToken,
    ensureAccessToken,
    restore,
    refresh,
    logout,
    clearTokens,
    setTokens
}
