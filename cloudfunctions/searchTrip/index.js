const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  try {
    var page = parseInt(event.page) || 1;
    var pageSize = Math.min(parseInt(event.pageSize) || 20, 50);
    var fromCity = (event.fromCity || "").trim();
    var toCity = (event.toCity || "").trim();

    var parts = [{ status: "recruiting" }];

    if (fromCity) {
      // 同时匹配多种城市名格式：
      // - 用户输入"北京" → 匹配数据库中"北京"或"北京市"
      // - 用户输入"北京市" → 也匹配"北京"
      var cityVariants = [fromCity];
      if (fromCity.indexOf("市") === -1) cityVariants.push(fromCity + "市");
      else cityVariants.push(fromCity.replace("市", ""));

      parts.push(_.or([
        { "from.city": _.in(cityVariants) },
        { "from.province": _.in(cityVariants) },
        { "from.district": fromCity },
        { "from": fromCity }
      ]));
    }

    if (toCity) {
      var toVariants = [toCity];
      if (toCity.indexOf("市") === -1) toVariants.push(toCity + "市");
      else toVariants.push(toCity.replace("市", ""));

      parts.push(_.or([
        { "to.city": _.in(toVariants) },
        { "to.province": _.in(toVariants) },
        { "to.district": toCity },
        { "to": toCity }
      ]));
    }

    if (event.departDate) {
      var d = new Date(event.departDate);
      var next = new Date(d);
      next.setDate(next.getDate() + 1);
      parts.push({ departDate: _.gte(d).and(_.lt(next)) });
    }

    if (event.maxPrice) parts.push({ price: _.lte(parseFloat(event.maxPrice)) });
    if (event.needSeats) parts.push({ seats: _.gte(parseInt(event.needSeats)) });

    var cond = parts.length > 1 ? _.and(parts) : parts[0];

    var totalResult = await db.collection("trips").where(cond).count();
    var total = totalResult.total;

    var query = db.collection("trips").where(cond);
    query = query.orderBy("departDate", "asc").orderBy("createTime", "desc");
    var result = await query.skip((page - 1) * pageSize).limit(pageSize).get();
    var list = result.data || [];


    // 填充车主信息
    var driverIds = list.map(function(t) { return t._openid; });
    var userMap = {};
    if (driverIds.length > 0) {
      try {
        var users = await db.collection("users").where({ _id: _.in(driverIds) }).get();
        (users.data || []).forEach(function(u) {
          userMap[u._id] = {
            nickName: u.nickName || "",
            avatarUrl: u.avatarUrl || "",
            ratingAvg: u.ratingAvg || 0,
            ratingCount: u.ratingCount || 0,
            idCardVerified: u.idCardVerified || false
          };
        });
      } catch(e) {}
    }

    var tripList = list.map(function(t) {
      return {
        _id: t._id,
        from: typeof t.from === 'string' ? { city: t.from, district: '', address: '' } : { city: t.from.city, district: t.from.district, address: t.from.address },
        to: typeof t.to === 'string' ? { city: t.to, district: '', address: '' } : { city: t.to.city, district: t.to.district, address: t.to.address },
        departDate: t.departDate,
        departTime: t.departTime,
        seats: t.seats - t.passengerCount,
        price: t.price,
        vehicleInfo: t.vehicleInfo || {},
        driver: userMap[t._openid] || {},
        passengerCount: t.passengerCount,
        tags: t.tags || [],
        createTime: t.createTime
      };
    });

    return {
      code: 0,
      data: { total: total, page: page, pageSize: pageSize, hasMore: page * pageSize < total, list: tripList }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
