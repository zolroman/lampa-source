import Account from './core/account/account'

let patched = false

function noop(call){
    if(call) call()
}

function patch(){
    if(patched) return

    window.lampa_settings.account_sync = false

    if(Account.Bookmarks){
        Account.Bookmarks.init = noop
        Account.Bookmarks.update = noop
    }

    if(Account.Timeline){
        Account.Timeline.init = noop
        Account.Timeline.update = noop
    }

    patched = true
}

let init = Account.init
let task = Account.task

Account.init = function(){
    patch()
    return init.apply(Account, arguments)
}

Account.task = function(){
    patch()
    return task.apply(Account, arguments)
}

export default Account
