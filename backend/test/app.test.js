const fs = require("fs/promises");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const createApp = require("../src/app");
const env = require("../src/config/env");
const Leftover = require("../src/models/Leftover");

jest.setTimeout(60000);

const testDbName = process.env.MONGO_TEST_DATABASE || "fridgevoid_test";
let app;

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function createLeftover(overrides = {}) {
  const now = new Date();
  return Leftover.create({
    food: "Rice",
    expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    location: "Fridge",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    tags: [],
    ...overrides,
  });
}

beforeAll(async () => {
  mongoose.set("autoIndex", true);
  await mongoose.connect(env.mongoUri, { dbName: testDbName });
  app = createApp();
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

describe("locations", () => {
  test("allows configured localhost CORS origins", async () => {
    await request(app)
      .options("/locations")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .expect(204)
      .expect((response) => {
        expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      });
  });

  test("lists built-in locations and manages custom locations", async () => {
    const initial = await request(app).get("/locations").expect(200);
    expect(initial.body.map((location) => location.name)).toEqual(["Freezer", "Fridge", "Pantry"]);
    expect(initial.body[0]).toMatchObject({ id: "freezer", defaultLocation: true, removable: false });

    const created = await request(app).post("/locations").send({ name: " Garage " }).expect(201);
    expect(created.body.location).toMatchObject({ name: "Garage", defaultLocation: false, removable: true });

    await request(app).post("/locations").send({ name: "garage" }).expect(409).expect((response) => {
      expect(response.body.message).toBe("Location already exists");
    });

    await request(app).delete(`/locations/${created.body.location.id}`).expect(200).expect((response) => {
      expect(response.body.message).toBe("Location deleted");
    });
  });

  test("prevents deleting a custom location while active or recoverable leftovers use it", async () => {
    const location = await request(app).post("/locations").send({ name: "Garage" }).expect(201);
    await createLeftover({ location: "Garage" });

    await request(app).delete(`/locations/${location.body.location.id}`).expect(409).expect((response) => {
      expect(response.body.message).toBe("Location is still in use");
    });
  });
});

describe("frontend route compatibility", () => {
  test("supports api-prefixed aliases used by VITE_API_BASE_URL=/api", async () => {
    await request(app).get("/api/locations").expect(200);
    await request(app).get("/api/preferences").expect(200);
    await request(app).get("/api/theme").expect(200);
    await request(app).get("/api/presets").expect(200);
    await request(app).get("/api/leftovers/home").expect(200).expect((response) => {
      expect(response.body).toEqual({ expiring: [], useSoon: [], expired: [], fresh: [] });
    });
  });

  test("preserves frontend error shape on unknown routes", async () => {
    await request(app).get("/api/missing").expect(404).expect((response) => {
      expect(response.body).toMatchObject({
        status: 404,
        error: "Not Found",
        message: "Not Found",
        path: "/api/missing",
      });
    });
  });
});

describe("leftovers", () => {
  test("creates, reads, filters, groups, soft deletes, and restores leftovers", async () => {
    const preset = await request(app)
      .post("/presets")
      .send({ name: "Soup", shelfLifeDays: 3, tags: ["meal"] })
      .expect(201);

    const created = await request(app)
      .post("/leftovers")
      .send({
        food: " Soup ",
        expirationDate: isoDaysFromNow(2),
        location: "Fridge",
        presetId: preset.body.id,
        tags: ["meal", "dinner"],
        container: " bowl ",
      })
      .expect(201);

    expect(created.body).toMatchObject({ message: "Leftover created", id: created.body.item.id });
    expect(created.body.item).toMatchObject({
      food: "Soup",
      location: "Fridge",
      status: "USE_SOON",
      tags: ["meal", "dinner"],
      container: "bowl",
    });

    await request(app).get(`/leftovers/${created.body.id}`).expect(200).expect((response) => {
      expect(response.body.food).toBe("Soup");
      expect(response.body.expirationDate).toBeTruthy();
      expect(response.body.recoverable).toBe(false);
    });

    await request(app).get("/leftovers?status=USE_SOON&tag=meal&food=so").expect(200).expect((response) => {
      expect(response.body).toHaveLength(1);
    });

    await request(app).get("/leftovers/search?food=soup").expect(200).expect((response) => {
      expect(response.body).toHaveLength(1);
    });

    await request(app).get("/leftovers/filter?tag=USE_SOON").expect(200).expect((response) => {
      expect(response.body).toHaveLength(1);
    });

    await request(app).get("/leftovers/home").expect(200).expect((response) => {
      expect(response.body.useSoon).toHaveLength(1);
      expect(response.body.expiring).toEqual([]);
      expect(response.body.expired).toEqual([]);
      expect(response.body.fresh).toEqual([]);
    });

    await request(app).delete(`/leftovers/${created.body.id}`).expect(200).expect((response) => {
      expect(response.body.message).toBe("Leftover deleted");
    });

    await request(app).get("/leftovers").expect(200).expect((response) => {
      expect(response.body).toHaveLength(0);
    });

    await request(app).get("/leftovers/recently-deleted").expect(200).expect((response) => {
      expect(response.body).toHaveLength(1);
      expect(response.body[0].recoverable).toBe(true);
      expect(response.body[0].recoverableUntil).toBeTruthy();
    });

    await request(app).post(`/leftovers/${created.body.id}/restore`).expect(200).expect((response) => {
      expect(response.body.message).toBe("Leftover restored");
      expect(response.body.item.deletedAt).toBeNull();
    });

    await request(app).get(`/presets/${preset.body.id}`).expect(200).expect((response) => {
      expect(response.body.usedCount).toBe(1);
    });
  });

  test("sorts and derives statuses like the original service", async () => {
    await createLeftover({ food: "Expired", expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), tags: ["old"] });
    await createLeftover({ food: "Expiring", expirationDate: new Date(Date.now() + 12 * 60 * 60 * 1000), tags: ["soon"] });
    await createLeftover({ food: "Use Soon", expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), tags: ["soon"] });
    await createLeftover({ food: "Fresh", expirationDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), tags: ["later"] });

    await request(app).get("/leftovers").expect(200).expect((response) => {
      expect(response.body.map((item) => item.status)).toEqual(["EXPIRING", "USE_SOON", "EXPIRED", "FRESH"]);
    });

    await request(app).get("/leftovers?sort=expiration-asc").expect(200).expect((response) => {
      expect(response.body[0].food).toBe("Expired");
    });
  });

  test("validates leftover requests and required search params", async () => {
    await request(app).post("/leftovers").send({ food: "   ", shelfLifeDays: 2 }).expect(400).expect((response) => {
      expect(response.body.message).toBe("Food is required");
    });

    await request(app).post("/leftovers").send({ food: "Soup", shelfLifeDays: 0 }).expect(400).expect((response) => {
      expect(response.body.message).toBe("shelfLifeDays must be greater than 0");
    });

    await request(app).post("/leftovers").send({ food: "Soup", expirationDate: "2026-01-01" }).expect(400).expect((response) => {
      expect(response.body.message).toBe("Invalid expirationDate");
    });

    await request(app).post("/leftovers").send({ food: "Soup", shelfLifeDays: 2, tags: "meal" }).expect(400).expect((response) => {
      expect(response.body.message).toBe("tags must be an array");
    });

    await request(app).get("/leftovers/search").expect(400).expect((response) => {
      expect(response.body.message).toBe("food is required");
    });
  });

  test("detects update conflicts without rejecting the update", async () => {
    const existing = await createLeftover({ updatedAt: new Date("2026-01-02T00:00:00.000Z") });

    await request(app)
      .put(`/leftovers/${existing._id}`)
      .send({ food: "Lemon Rice", lastKnownUpdatedAt: "2026-01-01T00:00:00.000Z" })
      .expect(200)
      .expect((response) => {
        expect(response.body.conflictDetected).toBe(true);
        expect(response.body.item.food).toBe("Lemon Rice");
      });
  });

  test("supports used-up, clear, and populate routes", async () => {
    const existing = await createLeftover();

    await request(app).post(`/leftovers/${existing._id}/used-up`).expect(200).expect((response) => {
      expect(response.body.message).toBe("Leftover marked used up");
    });

    await request(app).post("/leftovers/populate").expect(200).expect((response) => {
      expect(response.body.insertedCount).toBe(100);
    });

    await request(app).get("/leftovers/home").expect(200).expect((response) => {
      expect(response.body.expired).toHaveLength(25);
      expect(response.body.expiring).toHaveLength(25);
      expect(response.body.useSoon).toHaveLength(25);
      expect(response.body.fresh).toHaveLength(25);
      expect(response.body.expired[0].food).toBe("Apple");
      expect(response.body.expired[0].notes).toBe("School lunches");
      expect(response.body.expired.filter((item) => item.food === "Apple")).toHaveLength(1);
      expect(response.body.expired.every((item) => !/\s\d+$/.test(item.food))).toBe(true);
    });

    await request(app).delete("/leftovers/clear").expect(200).expect((response) => {
      expect(response.text).toBe("Cleared");
    });

    await request(app).get("/leftovers").expect(200).expect((response) => {
      expect(response.body).toHaveLength(0);
    });
  });
});

describe("presets and scanned products", () => {
  test("validates and manages presets", async () => {
    await request(app).post("/presets").send({ name: "", shelfLifeDays: 3 }).expect(400).expect((response) => {
      expect(response.body.message).toBe("Preset name is required");
    });

    const preset = await request(app)
      .post("/presets")
      .send({ name: "Soup", shelfLifeDays: 3, container: "jar", tags: ["meal"] })
      .expect(201);

    await request(app)
      .put(`/presets/${preset.body.id}`)
      .send({ name: "Stew", shelfLifeDays: 4, tags: ["meal", "winter"] })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ name: "Stew", shelfLifeDays: 4, tags: ["meal", "winter"] });
      });

    await request(app).delete(`/presets/${preset.body.id}`).expect(200).expect((response) => {
      expect(response.body.message).toBe("Preset deleted");
    });
  });

  test("upserts scanned products with correct status codes", async () => {
    await request(app).get("/scanned-products/123").expect(404);
    await request(app).post("/scanned-products").send({ code: " 123 ", name: "Milk" }).expect(201);
    await request(app).post("/scanned-products").send({ code: "123", name: "Oat Milk" }).expect(200);
    await request(app).put("/scanned-products/456").send({ name: "Beans" }).expect(201);
    await request(app).get("/scanned-products/123").expect(200).expect((response) => {
      expect(response.body.name).toBe("Oat Milk");
    });
  });
});

describe("preferences and theme", () => {
  test("returns defaults, updates, and resets preferences", async () => {
    await request(app).get("/preferences").expect(200).expect((response) => {
      expect(response.body.id).toBe("household");
      expect(response.body.defaultCardImageMode).toBe("emoji");
      expect(response.body.statusOrder).toEqual(["about_to_expire", "use_soon", "expired", "fresh"]);
    });

    await request(app)
      .put("/preferences")
      .send({
        statusLabels: { EXPIRING: "Use ASAP" },
        statusOrder: ["fresh", "expired", "use soon", "about to expire"],
        defaultCardImageMode: "image",
        compactCardMode: true,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.statusLabels.about_to_expire).toBe("Use ASAP");
        expect(response.body.statusOrder).toEqual(["fresh", "expired", "use_soon", "about_to_expire"]);
        expect(response.body.defaultCardImageMode).toBe("image");
        expect(response.body.compactCardMode).toBe(true);
      });

    await request(app).put("/preferences").send({ defaultCardImageMode: "photo" }).expect(400).expect((response) => {
      expect(response.body.message).toBe("defaultCardImageMode must be emoji or image");
    });

    await request(app).post("/preferences/reset-status-order").expect(200).expect((response) => {
      expect(response.body.statusOrder).toEqual(["about_to_expire", "use_soon", "expired", "fresh"]);
    });
  });

  test("updates theme on both aliases and validates complete palettes", async () => {
    const current = await request(app).get("/theme").expect(200);
    const next = current.body;
    next.light.primaryColor = "#000000";

    await request(app).put("/api/theme").send(next).expect(200).expect((response) => {
      expect(response.body.light.primaryColor).toBe("#000000");
    });

    await request(app).put("/theme").send({ light: next.light }).expect(400).expect((response) => {
      expect(response.body.message).toBe("Both light and dark theme settings are required");
    });
  });
});

describe("uploads", () => {
  test("stores images and rejects non-images", async () => {
    const uploaded = await request(app)
      .post("/uploads")
      .attach("file", Buffer.from("fake png"), { filename: "item.png", contentType: "image/png" })
      .expect(200);

    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
    await request(app).get(uploaded.body.imageUrl).expect(200);

    const filename = uploaded.body.imageUrl.slice("/uploads/".length);
    await fs.rm(path.join(env.uploadDir, filename), { force: true });

    await request(app)
      .post("/uploads")
      .attach("file", Buffer.from("text"), { filename: "note.txt", contentType: "text/plain" })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe("Only image uploads are allowed");
      });
  });
});
