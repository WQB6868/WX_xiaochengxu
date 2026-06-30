Component({
  properties: {
    trip: { type: Object, value: {} }
  },
  methods: {
    onTap: function() {
      this.triggerEvent('tap', { id: this.data.trip._id }, {});
    },
    formatDate: function(d) {
      if (!d) return "";
      try {
        var date = new Date(d);
        if (isNaN(date.getTime())) return "";
        return (date.getMonth() + 1) + "月" + date.getDate() + "日";
      } catch(e) { return ""; }
    }
  }
});