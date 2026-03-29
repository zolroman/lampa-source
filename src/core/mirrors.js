let connected = true

function init(){}

function task(call){
    connected = true

    if(call) call()
}

function test(call){
    if(call) call()
}

export default {
    init,
    task,
    connected: ()=>connected,
    test
}