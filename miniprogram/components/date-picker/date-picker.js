Component({
  properties: {
    value: { type: String, value: '' },
    start: { type: String, value: '' },
    end: { type: String, value: '' },
    placeholder: { type: String, value: '选择日期' }
  },
  methods: {
    onDateChange: function(e) {
      this.triggerEvent('change', { value: e.detail.value });
    }
  }
});
