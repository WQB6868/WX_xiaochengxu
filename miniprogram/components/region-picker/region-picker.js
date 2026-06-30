Component({
  properties: {
    region: { type: Array, value: [] }
  },
  methods: {
    onChange: function(e) {
      this.triggerEvent("change", { region: e.detail.value, code: e.detail.code });
    }
  }
});
