import Reguest from './utils/reguest'
import SyncAuth from './sync_auth'

let network  = new Reguest()
let origin   = 'http://127.0.0.1:8080'
let base_url = origin + '/api/sync'

function url(path = ''){
    return base_url + (path ? '/' + path.replace(/^\//,'') : '')
}

function rootUrl(path = ''){
    return origin + (path ? '/' + path.replace(/^\//,'') : '')
}

function request(path, params = {}, body = false, token = '', retry = false){
    return new Promise((resolve, reject)=>{
        let request = {
            timeout: 5000,
            dataType: 'json'
        }

        let headers = Object.assign({}, params.headers || {})

        if(body !== false) headers['Content-Type'] = 'application/json'

        Object.assign(request, params)

        if(token) headers['Authorization'] = 'Bearer ' + token

        request.headers = headers

        network.silent(url(path), resolve, (error)=>{
            if(retry && error && error.status == 401){
                SyncAuth.refresh().then(()=>{
                    return requestWithAuth(path, params, body, false)
                }).then(resolve).catch(()=>reject(error))
            }
            else reject(error)
        }, body, request)
    })
}

function requestWithAuth(path, params = {}, post = false, retry = true){
    let body = post === false ? false : JSON.stringify(post)

    return SyncAuth.ensureAccessToken().then((token)=>{
        return request(path, params, body, token, retry)
    })
}

export default {
    url,
    load: requestWithAuth,
    clear: network.clear,
    health: ()=> new Promise((resolve, reject)=>{
        network.silent(rootUrl('health'), resolve, reject, false, {
            timeout: 2000,
            dataType: 'json'
        })
    }),
    bootstrapStatus: ()=> requestWithAuth('bootstrap/status'),
    bootstrap: (payload)=> requestWithAuth('bootstrap', {}, payload),
    bookmarksStatus: (payload)=> requestWithAuth('bookmarks/status', {}, payload || {card_ids: []}),
    bookmarksList: (payload)=> requestWithAuth('bookmarks/list', {}, payload || {types: []}),
    bookmarksSet: (payload)=> requestWithAuth('bookmarks/set', {}, payload),
    bookmarksClear: (payload)=> requestWithAuth('bookmarks/clear', {}, payload),
    timelineGet: (payload)=> requestWithAuth('timeline/get', {}, payload || {hashes: []}),
    timelineSet: (payload)=> requestWithAuth('timeline/set', {}, payload)
}
