const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// Use the existing "requests" collection to store phone view requests
// Each request document gets a "phoneViewRequests" array field:
// [{ requesterOpenId, status, createTime, updateTime }]

exports.main = async function(event, context) {
  var { action, tripId, targetOpenId, requestId, approved } = event;
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  function findEntry(arr, requesterOpenId) {
    if (!arr) return -1;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].requesterOpenId === requesterOpenId) return i;
    }
    return -1;
  }

  try {
    if (action === "request") {
      // Store request in the "requests" document's phoneViewRequests array
      var reqDoc = await db.collection("requests").doc(tripId).get();
      if (!reqDoc.data) return { code: 2001, message: "请求不存在" };
      var pvr = reqDoc.data.phoneViewRequests || [];
      var idx = findEntry(pvr, openid);
      if (idx >= 0 && pvr[idx].status === "pending") {
        return { code: 0, data: { status: "pending" } };
      }
      var entry = {
        requesterOpenId: openid,
        status: "pending",
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };
      if (idx >= 0) {
        pvr[idx] = entry;
      } else {
        pvr.push(entry);
      }
      await db.collection("requests").doc(tripId).update({
        data: { phoneViewRequests: pvr }
      });
      return { code: 0, data: { status: "pending" } };
    }

    if (action === "approve") {
      // Find the request in the requests document
      var reqDoc = await db.collection("requests").doc(requestId).get();
      if (!reqDoc.data) return { code: 2001, message: "request not found" };
      var pvr = reqDoc.data.phoneViewRequests || [];
      // The target is the current user (passenger), find the entry with requesterOpenId = targetOpenId from event
      var targetRequester = event.targetRequesterOpenId;
      if (!targetRequester) return { code: 1001, message: "missing target" };
      var idx = findEntry(pvr, targetRequester);
      if (idx < 0) return { code: 2001, message: "no pending request" };
      pvr[idx].status = approved ? "approved" : "rejected";
      pvr[idx].updateTime = db.serverDate();
      await db.collection("requests").doc(requestId).update({
        data: { phoneViewRequests: pvr }
      });
      return { code: 0, data: { status: pvr[idx].status } };
    }

    if (action === "check") {
      var reqDoc = await db.collection("requests").doc(tripId).get();
      if (!reqDoc.data) return { code: 0, data: { status: "none" } };
      var pvr = reqDoc.data.phoneViewRequests || [];
      var idx = findEntry(pvr, openid);
      var status = idx >= 0 ? pvr[idx].status : "none";
      return { code: 0, data: { status: status } };
    }

    if (action === "pendingRequests") {
      // Find all requests where targetOpenId matches and has pending phone view requests
      var requests = await db.collection("requests").where({
        _openid: openid,
        status: "active"
      }).get();
      var results = [];
      for (var i = 0; i < requests.data.length; i++) {
        var r = requests.data[i];
        var pvr = r.phoneViewRequests || [];
        for (var j = 0; j < pvr.length; j++) {
          if (pvr[j].status === "pending") {
            var userDoc = await db.collection("users").doc(pvr[j].requesterOpenId).get();
            results.push({
              _id: r._id + "_" + pvr[j].requesterOpenId,
              tripId: r._id,
              requesterOpenId: pvr[j].requesterOpenId,
              requesterNickName: (userDoc.data && userDoc.data.nickName) || "unknown",
              createTime: pvr[j].createTime
            });
          }
        }
      }
      return { code: 0, data: { list: results } };
    }

    return { code: 1001, message: "unknown action" };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};