const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var result = await db.collection("vehicles").where({
      _openid: OPENID,
      status: "active"
    }).orderBy("isDefault", "desc").get();
    return { code: 0, data: { list: result.data || [] } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
