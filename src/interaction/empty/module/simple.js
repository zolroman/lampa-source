import Empty from '../empty'

export default {
    onEmpty: function(){
        let params = this.params.empty || {}
        params.buttons = params.buttons || []

        this.empty_class = new Empty(params)

        if(params.info_button) this.empty_class.addInfoButton(params.info_button)

        this.scroll.append(this.empty_class.render(true))

        this.start = this.empty_class.start.bind(this.empty_class)
    }
}