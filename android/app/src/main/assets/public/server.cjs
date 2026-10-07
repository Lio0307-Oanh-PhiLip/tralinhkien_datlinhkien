"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activityLogs: () => activityLogs,
  appStats: () => appStats,
  appUsers: () => appUsers,
  deviceIotBookings: () => deviceIotBookings,
  labelCatalog: () => labelCatalog,
  shortageBookings: () => shortageBookings,
  technicians: () => technicians
});
var import_pg_core, shortageBookings, labelCatalog, activityLogs, appStats, appUsers, technicians, deviceIotBookings;
var init_schema = __esm({
  "src/db/schema.ts"() {
    "use strict";
    import_pg_core = require("drizzle-orm/pg-core");
    shortageBookings = (0, import_pg_core.pgTable)("shortage_bookings", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      ticketNumber: (0, import_pg_core.text)("ticket_number").notNull(),
      partCode: (0, import_pg_core.text)("part_code").notNull(),
      partName: (0, import_pg_core.text)("part_name").notNull(),
      model: (0, import_pg_core.text)("model"),
      partsList: (0, import_pg_core.jsonb)("parts_list"),
      bookingDate: (0, import_pg_core.text)("booking_date").notNull(),
      requestedDate: (0, import_pg_core.text)("requested_date"),
      customerName: (0, import_pg_core.text)("customer_name").notNull(),
      customerPhone: (0, import_pg_core.text)("customer_phone").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      location: (0, import_pg_core.text)("location"),
      stockedInDate: (0, import_pg_core.text)("stocked_in_date"),
      calledCustomerDate: (0, import_pg_core.text)("called_customer_date"),
      callSubStatus: (0, import_pg_core.text)("call_sub_status"),
      appointmentDate: (0, import_pg_core.text)("appointment_date"),
      callNote: (0, import_pg_core.text)("call_note"),
      callLogs: (0, import_pg_core.jsonb)("call_logs"),
      customerArrivedDate: (0, import_pg_core.text)("customer_arrived_date"),
      technicianName: (0, import_pg_core.text)("technician_name"),
      note: (0, import_pg_core.text)("note"),
      cancelRequested: (0, import_pg_core.boolean)("cancel_requested").default(false),
      cancelReason: (0, import_pg_core.text)("cancel_reason"),
      cancelRequestedBy: (0, import_pg_core.text)("cancel_requested_by"),
      cancelRequestedAt: (0, import_pg_core.text)("cancel_requested_at"),
      customerKeepsPart: (0, import_pg_core.boolean)("customer_keeps_part").default(false),
      isCustomerCallHold: (0, import_pg_core.boolean)("is_customer_call_hold").default(false),
      isCompletedWithoutRepair: (0, import_pg_core.boolean)("is_completed_without_repair").default(false),
      closureReason: (0, import_pg_core.text)("closure_reason"),
      closureNote: (0, import_pg_core.text)("closure_note"),
      closureBy: (0, import_pg_core.text)("closure_by"),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      updatedAt: (0, import_pg_core.text)("updated_at").notNull(),
      history: (0, import_pg_core.jsonb)("history"),
      createdBy: (0, import_pg_core.text)("created_by"),
      createdByUid: (0, import_pg_core.text)("created_by_uid"),
      creatorTechnician: (0, import_pg_core.text)("creator_technician")
    });
    labelCatalog = (0, import_pg_core.pgTable)("label_catalog", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      code: (0, import_pg_core.text)("code").notNull(),
      name: (0, import_pg_core.text)("name").notNull(),
      model: (0, import_pg_core.text)("model"),
      category: (0, import_pg_core.text)("category"),
      quantity: (0, import_pg_core.integer)("quantity").default(1),
      price: (0, import_pg_core.text)("price"),
      location: (0, import_pg_core.text)("location"),
      date: (0, import_pg_core.text)("date"),
      note: (0, import_pg_core.text)("note")
    });
    activityLogs = (0, import_pg_core.pgTable)("activity_logs", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      action: (0, import_pg_core.text)("action").notNull(),
      ticketNumber: (0, import_pg_core.text)("ticket_number"),
      userName: (0, import_pg_core.text)("user_name"),
      timestamp: (0, import_pg_core.text)("timestamp").notNull(),
      details: (0, import_pg_core.text)("details")
    });
    appStats = (0, import_pg_core.pgTable)("app_stats", {
      key: (0, import_pg_core.text)("key").primaryKey(),
      value: (0, import_pg_core.jsonb)("value")
    });
    appUsers = (0, import_pg_core.pgTable)("app_users", {
      uid: (0, import_pg_core.text)("uid").primaryKey(),
      username: (0, import_pg_core.text)("username").notNull(),
      password: (0, import_pg_core.text)("password"),
      displayName: (0, import_pg_core.text)("display_name"),
      role: (0, import_pg_core.text)("role").notNull().default("staff"),
      status: (0, import_pg_core.text)("status").notNull().default("pending"),
      online: (0, import_pg_core.boolean)("online").default(false),
      lastActive: (0, import_pg_core.text)("last_active"),
      approvedBy: (0, import_pg_core.text)("approved_by"),
      approvedAt: (0, import_pg_core.text)("approved_at"),
      createdAt: (0, import_pg_core.text)("created_at")
    });
    technicians = (0, import_pg_core.pgTable)("technicians", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      techId: (0, import_pg_core.text)("tech_id").notNull(),
      name: (0, import_pg_core.text)("name").notNull(),
      phone: (0, import_pg_core.text)("phone"),
      department: (0, import_pg_core.text)("department"),
      status: (0, import_pg_core.text)("status").notNull().default("active"),
      requestedBy: (0, import_pg_core.text)("requested_by"),
      requestedAt: (0, import_pg_core.text)("requested_at"),
      approvedBy: (0, import_pg_core.text)("approved_by"),
      approvedAt: (0, import_pg_core.text)("approved_at"),
      note: (0, import_pg_core.text)("note"),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      updatedAt: (0, import_pg_core.text)("updated_at").notNull()
    });
    deviceIotBookings = (0, import_pg_core.pgTable)("device_iot_bookings", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      ticketNumber: (0, import_pg_core.text)("ticket_number").notNull(),
      customerName: (0, import_pg_core.text)("customer_name").notNull(),
      customerPhone: (0, import_pg_core.text)("customer_phone").notNull(),
      deviceModel: (0, import_pg_core.text)("device_model").notNull(),
      deviceName: (0, import_pg_core.text)("device_name").notNull(),
      skuCode: (0, import_pg_core.text)("sku_code"),
      imeiOrIot: (0, import_pg_core.text)("imei_or_iot").notNull(),
      deviceCategory: (0, import_pg_core.text)("device_category").default("phone"),
      flowType: (0, import_pg_core.text)("flow_type").notNull().default("request_device"),
      status: (0, import_pg_core.text)("status").notNull(),
      bookingDate: (0, import_pg_core.text)("booking_date").notNull(),
      requestedDate: (0, import_pg_core.text)("requested_date"),
      stockedInDate: (0, import_pg_core.text)("stocked_in_date"),
      location: (0, import_pg_core.text)("location"),
      hasDeposit: (0, import_pg_core.boolean)("has_deposit").default(false),
      depositType: (0, import_pg_core.text)("deposit_type"),
      depositAmount: (0, import_pg_core.text)("deposit_amount"),
      borrowedDate: (0, import_pg_core.text)("borrowed_date"),
      returnedDate: (0, import_pg_core.text)("returned_date"),
      loanHandoverBy: (0, import_pg_core.text)("loan_handover_by"),
      loanReceivedBy: (0, import_pg_core.text)("loan_received_by"),
      loanCondition: (0, import_pg_core.text)("loan_condition"),
      loanAccessories: (0, import_pg_core.text)("loan_accessories"),
      calledCustomerDate: (0, import_pg_core.text)("called_customer_date"),
      callSubStatus: (0, import_pg_core.text)("call_sub_status"),
      appointmentDate: (0, import_pg_core.text)("appointment_date"),
      callNote: (0, import_pg_core.text)("call_note"),
      callLogs: (0, import_pg_core.jsonb)("call_logs"),
      customerArrivedDate: (0, import_pg_core.text)("customer_arrived_date"),
      technicianName: (0, import_pg_core.text)("technician_name"),
      note: (0, import_pg_core.text)("note"),
      isCompletedWithoutExchange: (0, import_pg_core.boolean)("is_completed_without_exchange").default(false),
      closureReason: (0, import_pg_core.text)("closure_reason"),
      closureNote: (0, import_pg_core.text)("closure_note"),
      closureBy: (0, import_pg_core.text)("closure_by"),
      cancelRequested: (0, import_pg_core.boolean)("cancel_requested").default(false),
      cancelReason: (0, import_pg_core.text)("cancel_reason"),
      cancelRequestedBy: (0, import_pg_core.text)("cancel_requested_by"),
      cancelRequestedAt: (0, import_pg_core.text)("cancel_requested_at"),
      history: (0, import_pg_core.jsonb)("history"),
      createdBy: (0, import_pg_core.text)("created_by"),
      createdByUid: (0, import_pg_core.text)("created_by_uid"),
      creatorTechnician: (0, import_pg_core.text)("creator_technician"),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      updatedAt: (0, import_pg_core.text)("updated_at").notNull()
    });
  }
});

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_https = __toESM(require("https"), 1);
var import_http = __toESM(require("http"), 1);
var import_url = require("url");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");
init_schema();
var createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_URL;
    const poolConfig = connectionString ? {
      connectionString,
      max: 10,
      connectionTimeoutMillis: 1e4,
      idleTimeoutMillis: 3e4,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1e4,
      ssl: process.env.SQL_SSL === "true" ? { rejectUnauthorized: false } : void 0
    } : {
      host: process.env.SQL_HOST || process.env.PGHOST || "127.0.0.1",
      user: process.env.SQL_USER || process.env.PGUSER || "postgres",
      password: process.env.SQL_PASSWORD || process.env.PGPASSWORD || "",
      database: process.env.SQL_DB_NAME || process.env.PGDATABASE || "postgres",
      port: Number(process.env.SQL_PORT || process.env.PGPORT) || 5432,
      max: 10,
      connectionTimeoutMillis: 1e4,
      idleTimeoutMillis: 3e4,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1e4,
      ssl: process.env.SQL_SSL === "true" ? { rejectUnauthorized: false } : void 0
    };
    global._postgresPool = new import_pg.Pool(poolConfig);
    global._postgresPool.on("error", (err) => {
      const msg = err?.message || String(err);
      if (msg.includes("Connection terminated unexpectedly") || msg.includes("connection closed") || err?.code === "57P01" || err?.code === "ECONNRESET") {
        console.warn("PostgreSQL idle connection closed cleanly:", msg);
      } else {
        console.error("PostgreSQL pool unexpected error:", msg);
      }
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// server.ts
init_schema();
var import_drizzle_orm = require("drizzle-orm");
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});
var firestoreDb = null;
try {
  const cfgPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_fs.default.existsSync(cfgPath)) {
    const rawCfg = JSON.parse(import_fs.default.readFileSync(cfgPath, "utf-8"));
    const fbApp = (0, import_app.getApps)().length > 0 ? (0, import_app.getApp)() : (0, import_app.initializeApp)(rawCfg);
    firestoreDb = (0, import_firestore.getFirestore)(fbApp, rawCfg.firestoreDatabaseId);
    console.log("Server successfully connected to Cloud Firestore bridge.");
  }
} catch (e) {
  console.warn("Server firestore bridge init notice:", e);
}
function sanitizeForFirestore(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => value === void 0 ? null : value)
  );
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  const SERVER_BOOT_TIME = 175567e7;
  const CURRENT_APP_VERSION = "2.5.3";
  const CURRENT_BUILD_ID = "build-v253-part-autosuggest-sync";
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", provider: "Cloud SQL PostgreSQL", version: CURRENT_APP_VERSION, buildId: CURRENT_BUILD_ID });
  });
  app.get("/install-linux-icon.sh", (req, res) => {
    const publicScript = import_path.default.join(process.cwd(), "public/install-linux-icon.sh");
    const rootScript = import_path.default.join(process.cwd(), "install-linux-icon.sh");
    const scriptPath = import_fs.default.existsSync(publicScript) ? publicScript : rootScript;
    if (import_fs.default.existsSync(scriptPath)) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.sendFile(scriptPath);
    } else {
      res.status(404).send('#!/bin/bash\necho "Error: install-linux-icon.sh not found"\nexit 1\n');
    }
  });
  app.get("/api/version", (req, res) => {
    res.json({
      version: CURRENT_APP_VERSION,
      buildId: CURRENT_BUILD_ID,
      buildDate: "2026-08-20",
      timestamp: SERVER_BOOT_TIME,
      appName: "OPPO Label Studio & Shortage Hub",
      cloudSync: true,
      features: ["Live Cloud Sync", "OTA Auto-update", "Cloud SQL PostgreSQL", "GCSM Stock Checker"]
    });
  });
  app.get("/api/shortages", async (req, res) => {
    try {
      const items = await db.select().from(shortageBookings).orderBy((0, import_drizzle_orm.desc)(shortageBookings.updatedAt));
      res.json(items);
    } catch (error) {
      console.error("Error fetching shortages from SQL:", error);
      res.status(500).json({ error: "Failed to fetch shortages" });
    }
  });
  app.post("/api/shortages", async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: "Missing shortage item ID" });
      }
      await db.insert(shortageBookings).values({
        id: item.id,
        ticketNumber: item.ticketNumber || "",
        partCode: item.partCode || "",
        partName: item.partName || "",
        model: item.model || "",
        partsList: item.partsList || [],
        bookingDate: item.bookingDate || "",
        requestedDate: item.requestedDate || null,
        customerName: item.customerName || "",
        customerPhone: item.customerPhone || "",
        status: item.status || "da_tao_phieu",
        location: item.location || "",
        stockedInDate: item.stockedInDate || null,
        calledCustomerDate: item.calledCustomerDate || null,
        callSubStatus: item.callSubStatus || null,
        appointmentDate: item.appointmentDate || null,
        callNote: item.callNote || null,
        callLogs: item.callLogs || [],
        customerArrivedDate: item.customerArrivedDate || null,
        technicianName: item.technicianName || "",
        note: item.note || "",
        cancelRequested: Boolean(item.cancelRequested),
        cancelReason: item.cancelReason || null,
        cancelRequestedBy: item.cancelRequestedBy || null,
        cancelRequestedAt: item.cancelRequestedAt || null,
        customerKeepsPart: Boolean(item.customerKeepsPart),
        isCustomerCallHold: Boolean(item.isCustomerCallHold),
        isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
        closureReason: item.closureReason || null,
        closureNote: item.closureNote || null,
        closureBy: item.closureBy || null,
        createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        history: item.history || [],
        createdBy: item.createdBy || null,
        createdByUid: item.createdByUid || null,
        creatorTechnician: item.creatorTechnician || null
      }).onConflictDoUpdate({
        target: shortageBookings.id,
        set: {
          ticketNumber: item.ticketNumber || "",
          partCode: item.partCode || "",
          partName: item.partName || "",
          model: item.model || "",
          partsList: item.partsList || [],
          bookingDate: item.bookingDate || "",
          requestedDate: item.requestedDate || null,
          customerName: item.customerName || "",
          customerPhone: item.customerPhone || "",
          status: item.status || "da_tao_phieu",
          location: item.location || "",
          stockedInDate: item.stockedInDate || null,
          calledCustomerDate: item.calledCustomerDate || null,
          callSubStatus: item.callSubStatus || null,
          appointmentDate: item.appointmentDate || null,
          callNote: item.callNote || null,
          callLogs: item.callLogs || [],
          customerArrivedDate: item.customerArrivedDate || null,
          technicianName: item.technicianName || "",
          note: item.note || "",
          cancelRequested: Boolean(item.cancelRequested),
          cancelReason: item.cancelReason || null,
          cancelRequestedBy: item.cancelRequestedBy || null,
          cancelRequestedAt: item.cancelRequestedAt || null,
          customerKeepsPart: Boolean(item.customerKeepsPart),
          isCustomerCallHold: Boolean(item.isCustomerCallHold),
          isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
          closureReason: item.closureReason || null,
          closureNote: item.closureNote || null,
          closureBy: item.closureBy || null,
          updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
          history: item.history || [],
          createdBy: item.createdBy || null,
          createdByUid: item.createdByUid || null,
          creatorTechnician: item.creatorTechnician || null
        }
      });
      res.json({ success: true, item });
      if (firestoreDb) {
        try {
          const cleanItem = sanitizeForFirestore(item);
          await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "shortages", item.id), cleanItem, { merge: true });
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_shortages", "master_signal"), {
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server API Sync",
            count: 1,
            version: Date.now()
          }, { merge: true }).catch(() => {
          });
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_signals", "shortages_sync"), {
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server API Sync"
          }, { merge: true }).catch(() => {
          });
        } catch (fe) {
          console.warn("Server sync to Firestore notice:", fe);
        }
      }
    } catch (error) {
      console.error("Error saving shortage to SQL:", error);
      res.status(500).json({ error: "Failed to save shortage" });
    }
  });
  app.delete("/api/shortages/clear/all", async (req, res) => {
    try {
      await db.delete(shortageBookings);
      res.json({ success: true, message: "Cleared all shortages" });
      if (firestoreDb) {
        try {
          const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "shortages"));
          const batchPromises = snap.docs.map((d) => (0, import_firestore.deleteDoc)(d.ref));
          await Promise.all(batchPromises);
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_shortages", "master_signal"), {
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server API Clear All",
            count: 0,
            version: Date.now()
          }, { merge: true }).catch(() => {
          });
        } catch (fe) {
          console.warn("Server clear all Firestore notice:", fe);
        }
      }
    } catch (error) {
      console.error("Error clearing all shortages from SQL:", error);
      res.status(500).json({ error: "Failed to clear shortages" });
    }
  });
  app.delete("/api/shortages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(shortageBookings).where((0, import_drizzle_orm.eq)(shortageBookings.id, id));
      res.json({ success: true, id });
      if (firestoreDb) {
        try {
          await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(firestoreDb, "shortages", id));
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_shortages", "master_signal"), {
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server API Delete",
            count: 1,
            version: Date.now()
          }, { merge: true }).catch(() => {
          });
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_signals", "shortages_sync"), {
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server API Delete"
          }, { merge: true }).catch(() => {
          });
        } catch (fe) {
          console.warn("Server delete from Firestore notice:", fe);
        }
      }
    } catch (error) {
      console.error("Error deleting shortage from SQL:", error);
      res.status(500).json({ error: "Failed to delete shortage" });
    }
  });
  app.post("/api/shortages/bulk", async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            if (!item || !item.id) return;
            await db.insert(shortageBookings).values({
              id: item.id,
              ticketNumber: item.ticketNumber || "",
              partCode: item.partCode || "",
              partName: item.partName || "",
              model: item.model || "",
              partsList: item.partsList || [],
              bookingDate: item.bookingDate || "",
              requestedDate: item.requestedDate || null,
              customerName: item.customerName || "",
              customerPhone: item.customerPhone || "",
              status: item.status || "da_tao_phieu",
              location: item.location || "",
              stockedInDate: item.stockedInDate || null,
              calledCustomerDate: item.calledCustomerDate || null,
              callSubStatus: item.callSubStatus || null,
              appointmentDate: item.appointmentDate || null,
              callNote: item.callNote || null,
              callLogs: item.callLogs || [],
              customerArrivedDate: item.customerArrivedDate || null,
              technicianName: item.technicianName || "",
              note: item.note || "",
              cancelRequested: Boolean(item.cancelRequested),
              cancelReason: item.cancelReason || null,
              cancelRequestedBy: item.cancelRequestedBy || null,
              cancelRequestedAt: item.cancelRequestedAt || null,
              customerKeepsPart: Boolean(item.customerKeepsPart),
              isCustomerCallHold: Boolean(item.isCustomerCallHold),
              isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
              closureReason: item.closureReason || null,
              closureNote: item.closureNote || null,
              closureBy: item.closureBy || null,
              createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
              history: item.history || [],
              createdBy: item.createdBy || null,
              createdByUid: item.createdByUid || null,
              creatorTechnician: item.creatorTechnician || null
            }).onConflictDoUpdate({
              target: shortageBookings.id,
              set: {
                ticketNumber: item.ticketNumber || "",
                partCode: item.partCode || "",
                partName: item.partName || "",
                model: item.model || "",
                partsList: item.partsList || [],
                bookingDate: item.bookingDate || "",
                requestedDate: item.requestedDate || null,
                customerName: item.customerName || "",
                customerPhone: item.customerPhone || "",
                status: item.status || "da_tao_phieu",
                location: item.location || "",
                stockedInDate: item.stockedInDate || null,
                calledCustomerDate: item.calledCustomerDate || null,
                callSubStatus: item.callSubStatus || null,
                appointmentDate: item.appointmentDate || null,
                callNote: item.callNote || null,
                callLogs: item.callLogs || [],
                customerArrivedDate: item.customerArrivedDate || null,
                technicianName: item.technicianName || "",
                note: item.note || "",
                cancelRequested: Boolean(item.cancelRequested),
                cancelReason: item.cancelReason || null,
                cancelRequestedBy: item.cancelRequestedBy || null,
                cancelRequestedAt: item.cancelRequestedAt || null,
                customerKeepsPart: Boolean(item.customerKeepsPart),
                isCustomerCallHold: Boolean(item.isCustomerCallHold),
                isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
                closureReason: item.closureReason || null,
                closureNote: item.closureNote || null,
                closureBy: item.closureBy || null,
                updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
                history: item.history || [],
                createdBy: item.createdBy || null,
                createdByUid: item.createdByUid || null,
                creatorTechnician: item.creatorTechnician || null
              }
            });
          })
        );
      }
      res.json({ success: true, count: items.length });
      if (firestoreDb) {
        try {
          const batch = (0, import_firestore.writeBatch)(firestoreDb);
          let count = 0;
          for (const item of items) {
            if (item && item.id && count < 400) {
              batch.set((0, import_firestore.doc)(firestoreDb, "shortages", item.id), sanitizeForFirestore(item), { merge: true });
              count++;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_shortages", "master_signal"), {
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server Bulk Sync",
            count: items.length,
            version: Date.now()
          }, { merge: true }).catch(() => {
          });
          (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "system_signals", "shortages_sync"), {
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: "Server Bulk Sync"
          }, { merge: true }).catch(() => {
          });
        } catch (fe) {
          console.warn("Server bulk sync to Firestore notice:", fe);
        }
      }
    } catch (error) {
      console.error("Error bulk saving shortages to SQL:", error);
      res.status(500).json({ error: "Failed to bulk save shortages" });
    }
  });
  function fetchUrlContent(targetUrl, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        return reject(new Error("Too many redirects when fetching URL"));
      }
      try {
        const parsedUrl = new import_url.URL(targetUrl);
        const protocol = parsedUrl.protocol === "https:" ? import_https.default : import_http.default;
        const req = protocol.get(
          targetUrl,
          {
            maxHeaderSize: 512 * 1024,
            // 512 KB header size limit to prevent HeadersOverflowError
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/csv;q=0.8,*/*;q=0.7"
            }
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const redirectUrl = new import_url.URL(res.headers.location, targetUrl).toString();
              return fetchUrlContent(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
            }
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
              return reject(new Error(`HTTP status code ${res.statusCode}`));
            }
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              resolve(data);
            });
          }
        );
        req.on("error", (err) => {
          reject(err);
        });
        req.setTimeout(25e3, () => {
          req.destroy();
          reject(new Error("Request timeout after 25s"));
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  app.get("/api/sync-share-link", async (req, res) => {
    try {
      const targetUrl = req.query.url || "https://gemini.google.com/share/ed3e5875fe9e";
      let text2 = "";
      try {
        text2 = await fetchUrlContent(targetUrl);
      } catch (err) {
        console.warn("fetchUrlContent warning, fallback to manual parse mode:", err?.message);
        return res.json({
          success: false,
          url: targetUrl,
          totalParsed: 0,
          parsedItems: [],
          message: err?.message || "Could not fetch link content directly"
        });
      }
      const parsedItems = [];
      const seenCodes = /* @__PURE__ */ new Set();
      const isGoogleClientApp = text2.includes("gemini.google.com") || text2.includes("var(--gem-sys");
      let searchableText = text2.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/var\(--[\w-]+\)/gi, "").replace(/--[\w-]{5,}/gi, "");
      if (searchableText.includes("<table") || searchableText.includes("</td>") || searchableText.includes("</tr>")) {
        searchableText = searchableText.replace(/<\/tr>/gi, "\n").replace(/<\/td>/gi, "	").replace(/<\/th>/gi, "	").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
      }
      const lines = searchableText.split("\n");
      lines.forEach((line, index) => {
        const clean = line.trim();
        if (!clean || clean.startsWith("--") || clean.includes("{") || clean.includes("var(")) return;
        if (clean.toLowerCase().includes("m\xE3 sp") || clean.toLowerCase().includes("t\xEAn linh ki\u1EC7n") || clean.includes("---")) return;
        let rawCode = "";
        let model = "";
        let name = "";
        let category = "OTHERS";
        let location = "-";
        if (clean.includes("|")) {
          const parts = clean.split("|").map((p) => p.trim()).filter((p, i, arr) => i > 0 && i < arr.length - 1 || p.length > 0);
          if (parts.length >= 2) {
            rawCode = parts[0] || "";
            if (parts.length >= 3) {
              name = parts[1] || "";
              model = parts[2] || "";
              category = parts[3] || "OTHERS";
              location = parts[4] || "-";
            } else {
              name = parts[1] || "";
            }
          }
        } else if (clean.includes(",") || clean.includes("	")) {
          const delimiter = clean.includes("	") ? "	" : ",";
          const parts = clean.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ""));
          if (parts.length >= 2) {
            rawCode = parts[0] || "";
            name = parts[1] || "";
            model = parts[2] || parts[1] || "";
            if (parts.length >= 4) category = parts[3];
            if (parts.length >= 5) location = parts[4];
          }
        } else {
          const match = clean.match(/^([A-Z0-9\-_]{4,18})\s+(.+)/i);
          if (match) {
            rawCode = match[1];
            name = match[2];
          }
        }
        rawCode = rawCode.replace(/\b(info|check\s*tồn|check|tồn|copy)\b/gi, "").trim();
        const codeMatch = rawCode.match(/([0-9]{6,14}|[A-Z0-9\-_]{4,18})/i);
        const code = codeMatch ? codeMatch[1].toUpperCase().replace(/[^A-Z0-9\-_]/g, "") : "";
        const isJunk = !code || code.length < 3 || code.length > 20 || code.startsWith("-") || code.includes("--") || code.includes("GEM") || code.includes("TYPO") || code.includes("FONT") || code.includes("COLOR") || code.includes("CONTAINER");
        if (!isJunk && !seenCodes.has(code)) {
          seenCodes.add(code);
          parsedItems.push({
            id: `item_link_${code.toLowerCase()}_${Date.now()}_${index}`,
            code,
            model: model || "OPPO",
            name: name || `Linh ki\u1EC7n ${code}`,
            category: category || "OTHERS",
            quantity: 1,
            price: "",
            location: location || "-",
            date: (/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN"),
            note: "C\u1EADp nh\u1EADt t\u1EEB StockSync Hub",
            selected: true
          });
        }
      });
      res.json({
        success: true,
        url: targetUrl,
        totalParsed: parsedItems.length,
        parsedItems
      });
    } catch (error) {
      console.error("Error in /api/sync-share-link:", error);
      res.status(500).json({ error: error.message || "Failed to sync share link" });
    }
  });
  app.get("/api/catalog", async (req, res) => {
    try {
      const items = await db.select().from(labelCatalog);
      res.json(items);
    } catch (error) {
      console.error("Error fetching catalog from SQL:", error);
      res.status(500).json({ error: "Failed to fetch catalog" });
    }
  });
  app.post("/api/catalog/bulk", async (req, res) => {
    try {
      const { items, replace } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }
      if (replace) {
        await db.delete(labelCatalog);
      }
      const validItems = items.filter((item) => item && item.id);
      if (validItems.length === 0) {
        return res.json({ success: true, count: 0 });
      }
      const chunkSize = 1e3;
      for (let i = 0; i < validItems.length; i += chunkSize) {
        const chunk = validItems.slice(i, i + chunkSize);
        const valuesToInsert = chunk.map((item) => ({
          id: String(item.id).replace(/[\/\s#?]/g, "_"),
          code: item.code || "",
          name: item.name || "",
          model: item.model || "",
          category: item.category || "",
          quantity: Number(item.quantity) || 1,
          price: item.price || "",
          location: item.location || "",
          date: item.date || "",
          note: item.note || ""
        }));
        await db.insert(labelCatalog).values(valuesToInsert).onConflictDoUpdate({
          target: labelCatalog.id,
          set: {
            code: import_drizzle_orm.sql`excluded.code`,
            name: import_drizzle_orm.sql`excluded.name`,
            model: import_drizzle_orm.sql`excluded.model`,
            category: import_drizzle_orm.sql`excluded.category`,
            quantity: import_drizzle_orm.sql`excluded.quantity`,
            price: import_drizzle_orm.sql`excluded.price`,
            location: import_drizzle_orm.sql`excluded.location`,
            date: import_drizzle_orm.sql`excluded.date`,
            note: import_drizzle_orm.sql`excluded.note`
          }
        });
      }
      res.json({ success: true, count: validItems.length });
    } catch (error) {
      console.error("Error bulk saving catalog to SQL:", error);
      res.status(500).json({ error: "Failed to bulk save catalog" });
    }
  });
  app.post("/api/catalog", async (req, res) => {
    try {
      const item = req.body;
      await db.insert(labelCatalog).values({
        id: item.id,
        code: item.code || "",
        name: item.name || "",
        model: item.model || "",
        category: item.category || "",
        quantity: item.quantity || 1,
        price: item.price || "",
        location: item.location || "",
        date: item.date || "",
        note: item.note || ""
      }).onConflictDoUpdate({
        target: labelCatalog.id,
        set: {
          code: item.code || "",
          name: item.name || "",
          model: item.model || "",
          category: item.category || "",
          quantity: item.quantity || 1,
          price: item.price || "",
          location: item.location || "",
          date: item.date || "",
          note: item.note || ""
        }
      });
      res.json({ success: true, item });
    } catch (error) {
      console.error("Error saving catalog item to SQL:", error);
      res.status(500).json({ error: "Failed to save catalog item" });
    }
  });
  app.delete("/api/catalog", async (req, res) => {
    try {
      await db.delete(labelCatalog);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing catalog on SQL:", error);
      res.status(500).json({ error: "Failed to clear catalog" });
    }
  });
  app.delete("/api/catalog/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(labelCatalog).where((0, import_drizzle_orm.eq)(labelCatalog.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting catalog item from SQL:", error);
      res.status(500).json({ error: "Failed to delete catalog item" });
    }
  });
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const logs = await db.select().from(activityLogs).orderBy((0, import_drizzle_orm.desc)(activityLogs.timestamp));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs from SQL:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });
  app.post("/api/activity-logs", async (req, res) => {
    try {
      const log = req.body;
      const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await db.insert(activityLogs).values({
        id: logId,
        action: log.action || "",
        ticketNumber: log.ticketNumber || "",
        userName: log.userName || "",
        timestamp: log.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
        details: log.details || ""
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging activity to SQL:", error);
      res.status(500).json({ error: "Failed to log activity" });
    }
  });
  async function syncTechniciansFromFirestoreToSql() {
    if (!firestoreDb) return;
    try {
      const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "technicians"));
      if (!snap.empty) {
        for (const d of snap.docs) {
          const data = d.data();
          if (data && data.name) {
            const cleanName = String(data.name).trim();
            const cleanTechId = String(data.techId || d.id).trim().toUpperCase();
            const record = {
              id: d.id,
              techId: cleanTechId,
              name: cleanName,
              phone: data.phone ? String(data.phone).trim() : "",
              department: data.department ? String(data.department).trim() : "K\u1EF9 thu\u1EADt Ph\u1EA7n c\u1EE9ng",
              status: data.status || "active",
              requestedBy: data.requestedBy || null,
              requestedAt: data.requestedAt || null,
              approvedBy: data.approvedBy || null,
              approvedAt: data.approvedAt || null,
              note: data.note ? String(data.note).trim() : "",
              createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: data.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
            };
            const existing = await db.select().from(technicians).where((0, import_drizzle_orm.eq)(technicians.id, d.id));
            if (existing.length === 0) {
              await db.insert(technicians).values(record);
            } else {
              await db.update(technicians).set(record).where((0, import_drizzle_orm.eq)(technicians.id, d.id));
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn("Sync technicians from Firestore to SQL notice:", fsErr);
    }
  }
  syncTechniciansFromFirestoreToSql().catch((e) => console.warn("Startup tech sync error:", e));
  app.get("/api/technicians", async (req, res) => {
    try {
      let items = await db.select().from(technicians).orderBy((0, import_drizzle_orm.desc)(technicians.updatedAt));
      if (items.length === 0 && firestoreDb) {
        await syncTechniciansFromFirestoreToSql();
        items = await db.select().from(technicians).orderBy((0, import_drizzle_orm.desc)(technicians.updatedAt));
      }
      res.json(items);
    } catch (error) {
      console.error("Error fetching technicians from SQL:", error);
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });
  app.post("/api/technicians", async (req, res) => {
    try {
      const tech = req.body;
      if (!tech || !tech.name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const cleanName = String(tech.name).trim();
      const cleanTechId = String(tech.techId || `tech_${Date.now()}`).trim().toUpperCase();
      const id = tech.id || `tech_${cleanTechId.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const newTech = {
        id,
        techId: cleanTechId,
        name: cleanName,
        phone: tech.phone ? String(tech.phone).trim() : "",
        department: tech.department ? String(tech.department).trim() : "K\u1EF9 thu\u1EADt Ph\u1EA7n c\u1EE9ng",
        status: tech.status || "active",
        requestedBy: tech.requestedBy || null,
        requestedAt: tech.requestedAt || null,
        approvedBy: tech.approvedBy || null,
        approvedAt: tech.approvedAt || null,
        note: tech.note ? String(tech.note).trim() : "",
        createdAt: tech.createdAt || nowIso,
        updatedAt: tech.updatedAt || nowIso
      };
      const existing = await db.select().from(technicians).where((0, import_drizzle_orm.eq)(technicians.id, id));
      if (existing.length > 0) {
        await db.update(technicians).set(newTech).where((0, import_drizzle_orm.eq)(technicians.id, id));
      } else {
        await db.insert(technicians).values(newTech);
      }
      if (firestoreDb) {
        try {
          await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "technicians", id), sanitizeForFirestore(newTech), { merge: true });
        } catch (fsErr) {
          console.warn("Server Firestore sync technician notice:", fsErr);
        }
      }
      try {
        await db.insert(activityLogs).values({
          id: `log_${Date.now()}`,
          action: "SAVE_TECHNICIAN",
          userName: tech.approvedBy || tech.requestedBy || "Admin",
          timestamp: nowIso,
          details: `L\u01B0u th\xF4ng tin KTV: ${newTech.name} (${newTech.techId}) - Tr\u1EA1ng th\xE1i: ${newTech.status}`
        });
      } catch (e) {
      }
      res.json(newTech);
    } catch (error) {
      console.error("Error saving technician to SQL:", error);
      res.status(500).json({ error: "Failed to save technician" });
    }
  });
  app.put("/api/technicians/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const existing = await db.select().from(technicians).where((0, import_drizzle_orm.eq)(technicians.id, id));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Technician not found" });
      }
      const current = existing[0];
      const updatedTech = {
        ...current,
        ...updates,
        techId: updates.techId ? String(updates.techId).trim().toUpperCase() : current.techId,
        name: updates.name ? String(updates.name).trim() : current.name,
        phone: updates.phone !== void 0 ? String(updates.phone).trim() : current.phone,
        department: updates.department ? String(updates.department).trim() : current.department,
        status: updates.status || current.status,
        note: updates.note !== void 0 ? String(updates.note).trim() : current.note,
        updatedAt: nowIso
      };
      await db.update(technicians).set(updatedTech).where((0, import_drizzle_orm.eq)(technicians.id, id));
      if (firestoreDb) {
        try {
          await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "technicians", id), sanitizeForFirestore(updatedTech), { merge: true });
        } catch (fsErr) {
          console.warn("Server Firestore update technician notice:", fsErr);
        }
      }
      res.json(updatedTech);
    } catch (error) {
      console.error("Error updating technician in SQL:", error);
      res.status(500).json({ error: "Failed to update technician" });
    }
  });
  app.delete("/api/technicians/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(technicians).where((0, import_drizzle_orm.eq)(technicians.id, id));
      if (firestoreDb) {
        try {
          await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(firestoreDb, "technicians", id));
        } catch (fsErr) {
          console.warn("Server Firestore delete technician notice:", fsErr);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting technician from SQL:", error);
      res.status(500).json({ error: "Failed to delete technician" });
    }
  });
  let deviceIotSignal = {
    version: Date.now(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    count: 0,
    updatedBy: "System Init"
  };
  async function syncDeviceIotsFromFirestoreToSql() {
    if (!firestoreDb) return;
    try {
      const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "device_iot_bookings"));
      if (!snap.empty) {
        for (const d of snap.docs) {
          const item = d.data();
          if (item && (item.ticketNumber || item.customerName)) {
            const nowIso = (/* @__PURE__ */ new Date()).toISOString();
            const record = {
              id: d.id,
              ticketNumber: item.ticketNumber || "",
              customerName: item.customerName || "",
              customerPhone: item.customerPhone || "",
              deviceModel: item.deviceModel || "",
              deviceName: item.deviceName || "",
              skuCode: item.skuCode || null,
              imeiOrIot: item.imeiOrIot || "",
              deviceCategory: item.deviceCategory || "phone",
              flowType: item.flowType || "request_device",
              status: item.status || "cho_xin_may",
              bookingDate: item.bookingDate || "",
              requestedDate: item.requestedDate || null,
              stockedInDate: item.stockedInDate || null,
              location: item.location || "",
              hasDeposit: Boolean(item.hasDeposit),
              depositType: item.depositType || null,
              depositAmount: item.depositAmount ? String(item.depositAmount) : null,
              borrowedDate: item.borrowedDate || null,
              returnedDate: item.returnedDate || null,
              loanHandoverBy: item.loanHandoverBy || null,
              loanReceivedBy: item.loanReceivedBy || null,
              loanCondition: item.loanCondition || null,
              loanAccessories: item.loanAccessories || null,
              calledCustomerDate: item.calledCustomerDate || null,
              callSubStatus: item.callSubStatus || null,
              appointmentDate: item.appointmentDate || null,
              callNote: item.callNote || null,
              callLogs: item.callLogs || [],
              customerArrivedDate: item.customerArrivedDate || null,
              technicianName: item.technicianName || "",
              note: item.note || "",
              isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
              closureReason: item.closureReason || null,
              closureNote: item.closureNote || null,
              closureBy: item.closureBy || null,
              cancelRequested: Boolean(item.cancelRequested),
              cancelReason: item.cancelReason || null,
              cancelRequestedBy: item.cancelRequestedBy || null,
              cancelRequestedAt: item.cancelRequestedAt || null,
              history: item.history || [],
              createdBy: item.createdBy || null,
              createdByUid: item.createdByUid || null,
              creatorTechnician: item.creatorTechnician || null,
              createdAt: item.createdAt || nowIso,
              updatedAt: item.updatedAt || nowIso
            };
            const existing = await db.select().from(deviceIotBookings).where((0, import_drizzle_orm.eq)(deviceIotBookings.id, d.id));
            if (existing.length === 0) {
              await db.insert(deviceIotBookings).values(record);
            } else {
              await db.update(deviceIotBookings).set(record).where((0, import_drizzle_orm.eq)(deviceIotBookings.id, d.id));
            }
          }
        }
        console.log(`[DeviceIOT] Synced ${snap.size} device & IOT bookings from Firestore to SQL.`);
      }
    } catch (fsErr) {
      console.warn("[DeviceIOT] Sync from Firestore to SQL notice:", fsErr);
    }
  }
  syncDeviceIotsFromFirestoreToSql().catch((e) => console.warn("Startup device IOT sync error:", e));
  app.get("/api/device-iot", async (req, res) => {
    try {
      let items = await db.select().from(deviceIotBookings).orderBy((0, import_drizzle_orm.desc)(deviceIotBookings.updatedAt));
      if (items.length === 0 && firestoreDb) {
        await syncDeviceIotsFromFirestoreToSql();
        items = await db.select().from(deviceIotBookings).orderBy((0, import_drizzle_orm.desc)(deviceIotBookings.updatedAt));
      }
      res.json(items);
    } catch (error) {
      console.error("Error fetching device & IOT bookings from SQL:", error);
      res.status(500).json({ error: "Failed to fetch device & IOT bookings" });
    }
  });
  app.post("/api/device-iot", async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: "Missing device IOT item ID" });
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const record = {
        id: item.id,
        ticketNumber: item.ticketNumber || "",
        customerName: item.customerName || "",
        customerPhone: item.customerPhone || "",
        deviceModel: item.deviceModel || "",
        deviceName: item.deviceName || "",
        skuCode: item.skuCode || null,
        imeiOrIot: item.imeiOrIot || "",
        deviceCategory: item.deviceCategory || "phone",
        flowType: item.flowType || "request_device",
        status: item.status || "cho_xin_may",
        bookingDate: item.bookingDate || "",
        requestedDate: item.requestedDate || null,
        stockedInDate: item.stockedInDate || null,
        location: item.location || "",
        hasDeposit: Boolean(item.hasDeposit),
        depositType: item.depositType || null,
        depositAmount: item.depositAmount ? String(item.depositAmount) : null,
        borrowedDate: item.borrowedDate || null,
        returnedDate: item.returnedDate || null,
        loanHandoverBy: item.loanHandoverBy || null,
        loanReceivedBy: item.loanReceivedBy || null,
        loanCondition: item.loanCondition || null,
        loanAccessories: item.loanAccessories || null,
        calledCustomerDate: item.calledCustomerDate || null,
        callSubStatus: item.callSubStatus || null,
        appointmentDate: item.appointmentDate || null,
        callNote: item.callNote || null,
        callLogs: item.callLogs || [],
        customerArrivedDate: item.customerArrivedDate || null,
        technicianName: item.technicianName || "",
        note: item.note || "",
        isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
        closureReason: item.closureReason || null,
        closureNote: item.closureNote || null,
        closureBy: item.closureBy || null,
        cancelRequested: Boolean(item.cancelRequested),
        cancelReason: item.cancelReason || null,
        cancelRequestedBy: item.cancelRequestedBy || null,
        cancelRequestedAt: item.cancelRequestedAt || null,
        history: item.history || [],
        createdBy: item.createdBy || null,
        createdByUid: item.createdByUid || null,
        creatorTechnician: item.creatorTechnician || null,
        createdAt: item.createdAt || nowIso,
        updatedAt: item.updatedAt || nowIso
      };
      await db.insert(deviceIotBookings).values(record).onConflictDoUpdate({
        target: deviceIotBookings.id,
        set: record
      });
      if (firestoreDb) {
        try {
          await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "device_iot_bookings", item.id), sanitizeForFirestore(record), {
            merge: true
          });
        } catch (fe) {
          console.warn("[DeviceIOT] Firestore mirror notice:", fe);
        }
      }
      deviceIotSignal = {
        version: Date.now(),
        updatedAt: nowIso,
        count: 1,
        updatedBy: item.technicianName || item.createdBy || "User"
      };
      res.json({ success: true, item: record });
    } catch (error) {
      console.error("Error saving device & IOT booking to SQL:", error);
      res.status(500).json({ error: "Failed to save device & IOT booking" });
    }
  });
  app.post("/api/device-iot/batch", async (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item) => {
            if (!item || !item.id) return;
            const record = {
              id: item.id,
              ticketNumber: item.ticketNumber || "",
              customerName: item.customerName || "",
              customerPhone: item.customerPhone || "",
              deviceModel: item.deviceModel || "",
              deviceName: item.deviceName || "",
              skuCode: item.skuCode || null,
              imeiOrIot: item.imeiOrIot || "",
              deviceCategory: item.deviceCategory || "phone",
              flowType: item.flowType || "request_device",
              status: item.status || "cho_xin_may",
              bookingDate: item.bookingDate || "",
              requestedDate: item.requestedDate || null,
              stockedInDate: item.stockedInDate || null,
              location: item.location || "",
              hasDeposit: Boolean(item.hasDeposit),
              depositType: item.depositType || null,
              depositAmount: item.depositAmount ? String(item.depositAmount) : null,
              borrowedDate: item.borrowedDate || null,
              returnedDate: item.returnedDate || null,
              loanHandoverBy: item.loanHandoverBy || null,
              loanReceivedBy: item.loanReceivedBy || null,
              loanCondition: item.loanCondition || null,
              loanAccessories: item.loanAccessories || null,
              calledCustomerDate: item.calledCustomerDate || null,
              callSubStatus: item.callSubStatus || null,
              appointmentDate: item.appointmentDate || null,
              callNote: item.callNote || null,
              callLogs: item.callLogs || [],
              customerArrivedDate: item.customerArrivedDate || null,
              technicianName: item.technicianName || "",
              note: item.note || "",
              isCompletedWithoutExchange: Boolean(item.isCompletedWithoutExchange),
              closureReason: item.closureReason || null,
              closureNote: item.closureNote || null,
              closureBy: item.closureBy || null,
              cancelRequested: Boolean(item.cancelRequested),
              cancelReason: item.cancelReason || null,
              cancelRequestedBy: item.cancelRequestedBy || null,
              cancelRequestedAt: item.cancelRequestedAt || null,
              history: item.history || [],
              createdBy: item.createdBy || null,
              createdByUid: item.createdByUid || null,
              creatorTechnician: item.creatorTechnician || null,
              createdAt: item.createdAt || nowIso,
              updatedAt: item.updatedAt || nowIso
            };
            await db.insert(deviceIotBookings).values(record).onConflictDoUpdate({
              target: deviceIotBookings.id,
              set: record
            });
            if (firestoreDb) {
              try {
                await (0, import_firestore.setDoc)((0, import_firestore.doc)(firestoreDb, "device_iot_bookings", item.id), sanitizeForFirestore(record), {
                  merge: true
                });
              } catch (fe) {
              }
            }
          })
        );
      }
      deviceIotSignal = {
        version: Date.now(),
        updatedAt: nowIso,
        count: items.length,
        updatedBy: "Batch Import"
      };
      res.json({ success: true, count: items.length });
    } catch (error) {
      console.error("Error batch saving device & IOT to SQL:", error);
      res.status(500).json({ error: "Failed to batch save device & IOT" });
    }
  });
  app.delete("/api/device-iot/clear/all", async (req, res) => {
    try {
      await db.delete(deviceIotBookings);
      if (firestoreDb) {
        try {
          const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "device_iot_bookings"));
          const deletePromises = snap.docs.map((d) => (0, import_firestore.deleteDoc)(d.ref));
          await Promise.all(deletePromises);
        } catch (fe) {
          console.warn("[DeviceIOT] Server clear all Firestore notice:", fe);
        }
      }
      deviceIotSignal = {
        version: Date.now(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        count: 0,
        updatedBy: "Clear All"
      };
      res.json({ success: true, message: "Cleared all device & IOT bookings" });
    } catch (error) {
      console.error("Error clearing all device & IOT bookings from SQL:", error);
      res.status(500).json({ error: "Failed to clear device & IOT bookings" });
    }
  });
  app.delete("/api/device-iot/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(deviceIotBookings).where((0, import_drizzle_orm.eq)(deviceIotBookings.id, id));
      if (firestoreDb) {
        try {
          await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(firestoreDb, "device_iot_bookings", id));
        } catch (fe) {
          console.warn("[DeviceIOT] Server delete from Firestore notice:", fe);
        }
      }
      deviceIotSignal = {
        version: Date.now(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        count: 1,
        updatedBy: "Delete"
      };
      res.json({ success: true, id });
    } catch (error) {
      console.error("Error deleting device & IOT booking from SQL:", error);
      res.status(500).json({ error: "Failed to delete device & IOT booking" });
    }
  });
  app.get("/api/signals/device-iot", (req, res) => {
    res.json(deviceIotSignal);
  });
  app.post("/api/signals/device-iot", (req, res) => {
    const { updatedBy, count } = req.body || {};
    deviceIotSignal = {
      version: Date.now(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: typeof count === "number" ? count : 1,
      updatedBy: updatedBy || "Client Trigger"
    };
    res.json({ success: true, signal: deviceIotSignal });
  });
  function parseDateOrIso(dateStr) {
    if (!dateStr) return 0;
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return parsed;
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const [_, d, m, y, h = "0", min = "0", s = "0"] = match;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s)).getTime();
    }
    return 0;
  }
  function isUserRecentlyActive(lastActive, windowMs = 12e4) {
    if (!lastActive) return false;
    const activeMs = parseDateOrIso(lastActive);
    if (activeMs === 0) return false;
    return Date.now() - activeMs <= windowMs;
  }
  app.get("/api/users", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const allUsers = await db.select().from(appUsers2);
      const userMap = /* @__PURE__ */ new Map();
      for (const u of allUsers) {
        const uname = (u.username || u.uid || "").trim().toLowerCase();
        const isOnline = isUserRecentlyActive(u.lastActive, 12e4) && u.online !== false;
        const normalized = {
          ...u,
          online: isOnline
        };
        if (!userMap.has(uname)) {
          userMap.set(uname, normalized);
        } else {
          const existing = userMap.get(uname);
          const existingMs = parseDateOrIso(existing.lastActive);
          const currentMs = parseDateOrIso(u.lastActive);
          if (u.uid === "admin-master" || currentMs > existingMs) {
            userMap.set(uname, normalized);
          }
        }
      }
      res.json(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error fetching users from SQL:", error);
      res.json([]);
    }
  });
  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { uid } = req.params;
      const users = await db.select().from(appUsers2).where((0, import_drizzle_orm.eq)(appUsers2.uid, uid));
      if (users.length > 0) {
        const u = users[0];
        res.json({
          ...u,
          online: isUserRecentlyActive(u.lastActive, 12e4) && u.online !== false
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app.post("/api/users", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const u = req.body;
      if (!u || !u.uid && !u.username) {
        return res.status(400).json({ error: "Missing uid or username" });
      }
      const cleanUsername = (u.username || "").trim().toLowerCase();
      let targetUid = u.uid || `user_${cleanUsername}`;
      if (cleanUsername === "admin") {
        targetUid = "admin-master";
      } else if (cleanUsername) {
        const existingUsers = await db.select().from(appUsers2).where((0, import_drizzle_orm.eq)(appUsers2.username, cleanUsername));
        if (existingUsers.length > 0) {
          targetUid = existingUsers[0].uid;
        }
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const setObj = {
        lastActive: u.lastActive || nowIso
      };
      if (u.username !== void 0) setObj.username = cleanUsername;
      if (u.password !== void 0) setObj.password = u.password;
      if (u.displayName !== void 0) setObj.displayName = u.displayName;
      if (u.role !== void 0) setObj.role = u.role;
      if (u.status !== void 0) setObj.status = u.status;
      if (u.online !== void 0) setObj.online = Boolean(u.online);
      if (u.approvedBy !== void 0) setObj.approvedBy = u.approvedBy;
      if (u.approvedAt !== void 0) setObj.approvedAt = u.approvedAt;
      await db.insert(appUsers2).values({
        uid: targetUid,
        username: cleanUsername || "staff",
        password: u.password || "",
        displayName: u.displayName || cleanUsername || "",
        role: u.role || (cleanUsername === "admin" ? "admin" : "staff"),
        status: u.status || (cleanUsername === "admin" ? "approved" : "pending"),
        online: u.online !== void 0 ? Boolean(u.online) : true,
        lastActive: u.lastActive || nowIso,
        approvedBy: u.approvedBy || null,
        approvedAt: u.approvedAt || null,
        createdAt: u.createdAt || nowIso
      }).onConflictDoUpdate({
        target: appUsers2.uid,
        set: setObj
      });
      res.json({ success: true, uid: targetUid, user: { ...u, uid: targetUid } });
    } catch (error) {
      console.error("Error saving user to SQL:", error);
      res.status(500).json({ error: "Failed to save user" });
    }
  });
  app.post("/api/users/presence", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { uid, online } = req.body;
      if (uid) {
        await db.update(appUsers2).set({
          online: Boolean(online),
          lastActive: (/* @__PURE__ */ new Date()).toISOString()
        }).where((0, import_drizzle_orm.eq)(appUsers2.uid, uid));
      }
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false });
    }
  });
  app.delete("/api/users/:uid", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { uid } = req.params;
      await db.delete(appUsers2).where((0, import_drizzle_orm.eq)(appUsers2.uid, uid));
      res.json({ success: true, uid });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  app.get("/api/analytics", async (req, res) => {
    try {
      const { appUsers: appUsers2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const stats = await db.select().from(appStats).where((0, import_drizzle_orm.eq)(appStats.key, "traffic"));
      let totalVisits = 1;
      if (stats.length > 0 && stats[0].value) {
        const val = stats[0].value;
        totalVisits = Number(val.totalVisits) || 1;
      }
      const allUsers = await db.select().from(appUsers2);
      const activeUsernames = /* @__PURE__ */ new Set();
      for (const u of allUsers) {
        if (isUserRecentlyActive(u.lastActive, 12e4) && u.online !== false) {
          activeUsernames.add((u.username || u.uid).toLowerCase());
        }
      }
      const onlineCount = Math.max(1, activeUsernames.size);
      res.json({
        totalVisits,
        onlineCount,
        activeUsers: Array.from(activeUsernames)
      });
    } catch (error) {
      res.json({ totalVisits: 1, onlineCount: 1 });
    }
  });
  app.post("/api/analytics", async (req, res) => {
    try {
      const stats = await db.select().from(appStats).where((0, import_drizzle_orm.eq)(appStats.key, "traffic"));
      let currentVisits = 0;
      if (stats.length > 0 && stats[0].value) {
        const val = stats[0].value;
        currentVisits = Number(val.totalVisits) || 0;
      }
      const newTotal = currentVisits + 1;
      const payload = {
        totalVisits: newTotal,
        lastVisitAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await db.insert(appStats).values({
        key: "traffic",
        value: payload
      }).onConflictDoUpdate({
        target: appStats.key,
        set: { value: payload }
      });
      res.json(payload);
    } catch (error) {
      console.error("Error updating analytics to SQL:", error);
      res.status(500).json({ error: "Failed to update analytics" });
    }
  });
  let distPath = import_path.default.join(process.cwd(), "dist");
  if (!import_fs.default.existsSync(import_path.default.join(distPath, "index.html")) && import_fs.default.existsSync(import_path.default.join(process.cwd(), "index.html"))) {
    distPath = process.cwd();
  }
  const indexHtmlPath = import_path.default.join(distPath, "index.html");
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware not available, falling back to static serving", e);
      app.use(import_express.default.static(distPath));
      app.get("*", (req, res) => {
        if (import_fs.default.existsSync(indexHtmlPath)) {
          res.sendFile(indexHtmlPath);
        } else {
          res.status(404).send("Application build not found.");
        }
      });
    }
  } else {
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      if (import_fs.default.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(404).send("Application build not found.");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    (async () => {
      if (!firestoreDb) return;
      try {
        console.log("Starting Firestore-to-SQL shortages backfill...");
        const snap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(firestoreDb, "shortages"));
        let backfilledCount = 0;
        for (const d of snap.docs) {
          const item = d.data();
          if (item && item.id) {
            const hasCreatorInfo = item.createdBy || item.creatorTechnician || item.requestedDate;
            if (hasCreatorInfo) {
              const existingSql = await db.select().from(shortageBookings).where((0, import_drizzle_orm.eq)(shortageBookings.id, item.id)).limit(1);
              if (existingSql.length > 0) {
                const sqlRow = existingSql[0];
                const sqlNeedsUpdate = !sqlRow.createdBy || !sqlRow.creatorTechnician || !sqlRow.requestedDate;
                if (sqlNeedsUpdate) {
                  await db.update(shortageBookings).set({
                    createdBy: sqlRow.createdBy || item.createdBy || null,
                    createdByUid: sqlRow.createdByUid || item.createdByUid || null,
                    creatorTechnician: sqlRow.creatorTechnician || item.creatorTechnician || null,
                    requestedDate: sqlRow.requestedDate || item.requestedDate || null
                  }).where((0, import_drizzle_orm.eq)(shortageBookings.id, item.id));
                  backfilledCount++;
                }
              } else {
                await db.insert(shortageBookings).values({
                  id: item.id,
                  ticketNumber: item.ticketNumber || "",
                  partCode: item.partCode || "",
                  partName: item.partName || "",
                  model: item.model || "",
                  partsList: item.partsList || [],
                  bookingDate: item.bookingDate || "",
                  requestedDate: item.requestedDate || null,
                  customerName: item.customerName || "",
                  customerPhone: item.customerPhone || "",
                  status: item.status || "da_tao_phieu",
                  location: item.location || "",
                  stockedInDate: item.stockedInDate || null,
                  calledCustomerDate: item.calledCustomerDate || null,
                  callSubStatus: item.callSubStatus || null,
                  appointmentDate: item.appointmentDate || null,
                  callNote: item.callNote || null,
                  callLogs: item.callLogs || [],
                  customerArrivedDate: item.customerArrivedDate || null,
                  technicianName: item.technicianName || "",
                  note: item.note || "",
                  cancelRequested: Boolean(item.cancelRequested),
                  cancelReason: item.cancelReason || null,
                  cancelRequestedBy: item.cancelRequestedBy || null,
                  cancelRequestedAt: item.cancelRequestedAt || null,
                  customerKeepsPart: Boolean(item.customerKeepsPart),
                  isCustomerCallHold: Boolean(item.isCustomerCallHold),
                  isCompletedWithoutRepair: Boolean(item.isCompletedWithoutRepair),
                  closureReason: item.closureReason || null,
                  closureNote: item.closureNote || null,
                  closureBy: item.closureBy || null,
                  createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
                  updatedAt: item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
                  history: item.history || [],
                  createdBy: item.createdBy || null,
                  createdByUid: item.createdByUid || null,
                  creatorTechnician: item.creatorTechnician || null
                }).onConflictDoNothing();
                backfilledCount++;
              }
            }
          }
        }
        console.log(`Firestore-to-SQL shortages backfill completed! Updated/Inserted ${backfilledCount} records.`);
      } catch (err) {
        console.error("Error during Firestore-to-SQL shortages backfill:", err);
      }
    })();
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
