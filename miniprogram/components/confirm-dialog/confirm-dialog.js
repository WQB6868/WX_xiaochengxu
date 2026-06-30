Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: "提示" },
    content: { type: String, value: "" },
    confirmText: { type: String, value: "确定" },
    cancelText: { type: String, value: "取消" },
    confirmColor: { type: String, value: "#07c160" }
  },
  methods: {
    onConfirm: function() { this.triggerEvent('confirm'); },
    onCancel: function() { this.triggerEvent('cancel'); this.setData({ show: false }); }
  }
});
