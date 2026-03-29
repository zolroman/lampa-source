let responce_code = 'ru'

function region(call){
    if(call) call(responce_code)
}

function task(call){
    if(call) call()
}

export default {
    region,
    task,
    code: ()=>responce_code,
}