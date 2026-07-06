const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
exports.main = async function(event, context) {
  try {
    var page = parseInt(event.page) || 1;
    var pageSize = Math.min(parseInt(event.pageSize) || 50, 100);
    var condition = { status: "active" };
    if (event.fromCity) {
      var cityVariants = [event.fromCity];
      if (event.fromCity.indexOf("市") === -1) cityVariants.push(event.fromCity + "市");
      else cityVariants.push(event.fromCity.replace("市", ""));
      condition.fromCity = _.in(cityVariants);
    }
    if (event.toCity) {
      var toVariants = [event.toCity];
      if (event.toCity.indexOf("市") === -1) toVariants.push(event.toCity + "市");
      else toVariants.push(event.toCity.replace("市", ""));
      condition.toCity = _.in(toVariants);
    }
    if (event.departDate) {
      var d = new Date(event.departDate);
      var next = new Date(d);
      next.setDate(next.getDate() + 1);
      condition.departDate = _.gte(d).and(_.lt(next));
    }
    var totalResult = await db.collection("requests").where(condition).count();
    var result = await db.collection("requests").where(condition)
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize).limit(pageSize).get();
    var list = (result.data || []).map(function(r) {
      return {
        _id: r._id,
        _openid: r._openid,
        fromCity: r.fromCity,
        toCity: r.toCity,
        departDate: r.departDate,
        departTime: r.departTime || "",
        passengers: r.passengers,
        contactPhone: r.contactPhone,
        remarks: r.remarks,
        createTime: r.createTime
      };
    });
    return {
      code: 0,
      data: { total: totalResult.total, page: page, pageSize: pageSize, hasMore: page * pageSize < totalResult.total, list: list }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};