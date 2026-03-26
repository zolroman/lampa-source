import Reguest from './utils/reguest'
import Storage from './core/storage/storage'
import Utils from './utils/utils'

let network  = new Reguest()
let root_url = 'http://127.0.0.1:8080'
let base_url = 'http://127.0.0.1:8080/api/sync'

function url(path = ''){
    return base_url + (path ? '/' + path.replace(/^\//,'') : '')
}

function rootUrl(path = ''){
    return root_url + (path ? '/' + path.replace(/^\//,'') : '')
}

function ensureDeviceId(){
    let uid = Storage.get('lampa_uid', '') + ''

    if(!uid){
        uid = Utils.uid()

        Storage.set('lampa_uid', uid, true)
    }

    return uid
}

function userId(){
    let user = Storage.get('account_user', '{}') || {}

    if(user.id) return 'user:' + user.id

    let account = Storage.get('account', '{}') || {}
    let email   = ((account.email || Storage.get('account_email', '') || '') + '').trim().toLowerCase()

    if(email) return 'email:' + email

    return 'device:' + ensureDeviceId()
}

function load(path, params = {}, post = false, with_user = true){
    return new Promise((resolve, reject)=>{
        let request = {
            timeout: 5000,
            dataType: 'json'
        }

        let headers = Object.assign({}, params.headers || {})

        if(post !== false){
            headers['Content-Type'] = 'application/json'

            post = JSON.stringify(post)
        }

        Object.assign(request, params)

        if(with_user) headers['X-Lampa-User-Id'] = userId()

        request.headers = headers

        network.silent(url(path), resolve, reject, post, request)
    })
}

export default {
    url,
    load,
    clear: network.clear,
    health: ()=> new Promise((resolve, reject)=>{
        network.silent(rootUrl('health'), resolve, reject, false, {
            timeout: 2000,
            dataType: 'json'
        })
    }),
    bootstrapStatus: ()=> load('bootstrap/status'),
    bootstrap: (payload)=> load('bootstrap', {}, payload),
    bookmarksDump: ()=> load('bookmarks/dump'),
    bookmarksChangelog: (since)=> load('bookmarks/changelog?since=' + since),
    bookmarksAdd: (payload)=> load('bookmarks/add', {}, payload),
    bookmarksRemove: (payload)=> load('bookmarks/remove', {}, payload),
    bookmarksClear: (payload)=> load('bookmarks/clear', {}, payload),
    timelineDump: ()=> load('timeline/dump'),
    timelineChangelog: (since)=> load('timeline/changelog?since=' + since),
    timelineUpsert: (payload)=> load('timeline/upsert', {}, payload)
}
