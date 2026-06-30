const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const users = db.collection("users");

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    // Use where query instead of doc().get() to avoid error when doc doesn't exist
    var userResult = await users.where({ _id: OPENID }).get();
    var isNewUser = false;
    var userData = userResult.data && userResult.data[0] || null;

    if (!userData) {
      // New user - create document
      isNewUser = true;
      userData = {
        _id: OPENID,
        nickName: "微信用户",
        avatarUrl: "",
        phone: "",
        gender: 0,
        realName: "",
        idCard: "",
        idCardVerified: false,
        ratingAvg: 0,
        ratingCount: 0,
        tripCountAsDriver: 0,
        tripCountAsPassenger: 0,
        status: "normal",
        createTime: db.serverDate(),
        lastLoginTime: db.serverDate(),
        emergencyContact: { name: "", phone: "" },
        subscribeTemplateIds: []
      };
      await users.add({ data: userData });
    } else {
      // Existing user - update login time
      await users.doc(OPENID).update({
        data: { lastLoginTime: db.serverDate() }
      });
      userData.lastLoginTime = db.serverDate();
    }

    return {
      code: 0,
      data: {
        openid: OPENID,
        isNewUser: isNewUser,
        user: sanitizeUser(userData)
      }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};

function sanitizeUser(user) {
  return {
    nickName: user.nickName || "",
    avatarUrl: user.avatarUrl || "",
    ratingAvg: user.ratingAvg || 0,
    ratingCount: user.ratingCount || 0,
    idCardVerified: user.idCardVerified || false,
    tripCountAsDriver: user.tripCountAsDriver || 0,
    tripCountAsPassenger: user.tripCountAsPassenger || 0,
    phone: maskPhone(user.phone || ""),
    createTime: user.createTime
  };
}

function maskPhone(phone) {
  if (!phone || phone.length < 11) return "";
  return phone.substring(0, 3) + "****" + phone.substring(7);
}
