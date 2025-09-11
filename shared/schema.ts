import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull(),
  propertyName: text("property_name").notNull(),
  city: text("city"),
  state: text("state"),
  propertyType: text("property_type"),
  totalUnits: integer("total_units"),
  builtYear: integer("built_year"),
  squareFootage: integer("square_footage"),
  parkingSpaces: integer("parking_spaces"),
  amenities: json("amenities").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow()
});

export const propertyAnalysis = pgTable("property_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  marketPosition: text("market_position").notNull(),
  competitiveAdvantages: json("competitive_advantages").$type<string[]>().notNull(),
  pricingInsights: text("pricing_insights").notNull(),
  recommendations: json("recommendations").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const competitorProperties = pgTable("competitor_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  distance: decimal("distance", { precision: 5, scale: 2 }).notNull(),
  priceRange: text("price_range").notNull(),
  totalUnits: integer("total_units").notNull(),
  builtYear: integer("built_year").notNull(),
  amenities: json("amenities").$type<string[]>().notNull().default([]),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }).notNull(),
  vacancyRate: decimal("vacancy_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const propertyUnits = pgTable("property_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  unitNumber: text("unit_number").notNull(),
  unitType: text("unit_type").notNull(),
  currentRent: decimal("current_rent", { precision: 10, scale: 2 }).notNull(),
  recommendedRent: decimal("recommended_rent", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("occupied"), // vacant, occupied, notice_given
  createdAt: timestamp("created_at").defaultNow()
});

export const optimizationReports = pgTable("optimization_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  goal: text("goal").notNull(),
  riskTolerance: text("risk_tolerance").notNull(),
  timeline: text("timeline").notNull(),
  totalIncrease: decimal("total_increase", { precision: 10, scale: 2 }).notNull(),
  affectedUnits: integer("affected_units").notNull(),
  avgIncrease: decimal("avg_increase", { precision: 5, scale: 2 }).notNull(),
  riskLevel: text("risk_level").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Scrapezy scraping jobs and cached data
export const scrapingJobs = pgTable("scraping_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  stage: text("stage").notNull(), // "city_discovery" or "unit_details"
  cityUrl: text("city_url").notNull(),
  scrapezyJobId: text("scrapezy_job_id"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  results: json("results").$type<any>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

export const scrapedProperties = pgTable("scraped_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scrapingJobId: varchar("scraping_job_id").references(() => scrapingJobs.id).notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  url: text("url").notNull(),
  distance: decimal("distance", { precision: 5, scale: 2 }),
  isSubjectProperty: boolean("is_subject_property").default(false),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow()
});

export const scrapedUnits = pgTable("scraped_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => scrapedProperties.id).notNull(),
  unitNumber: text("unit_number"),
  unitType: text("unit_type").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  squareFootage: integer("square_footage"),
  rent: decimal("rent", { precision: 10, scale: 2 }),
  availabilityDate: text("availability_date"),
  status: text("status").default("available"), // available, occupied, pending
  createdAt: timestamp("created_at").defaultNow()
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertPropertyAnalysisSchema = createInsertSchema(propertyAnalysis).omit({ id: true, createdAt: true });
export const insertCompetitorPropertySchema = createInsertSchema(competitorProperties).omit({ id: true, createdAt: true });
export const insertPropertyUnitSchema = createInsertSchema(propertyUnits).omit({ id: true, createdAt: true });
export const insertOptimizationReportSchema = createInsertSchema(optimizationReports).omit({ id: true, createdAt: true });
export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({ id: true, createdAt: true, completedAt: true });
export const insertScrapedPropertySchema = createInsertSchema(scrapedProperties).omit({ id: true, createdAt: true });
export const insertScrapedUnitSchema = createInsertSchema(scrapedUnits).omit({ id: true, createdAt: true });

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type PropertyAnalysis = typeof propertyAnalysis.$inferSelect;
export type InsertPropertyAnalysis = z.infer<typeof insertPropertyAnalysisSchema>;
export type CompetitorProperty = typeof competitorProperties.$inferSelect;
export type InsertCompetitorProperty = z.infer<typeof insertCompetitorPropertySchema>;
export type PropertyUnit = typeof propertyUnits.$inferSelect;
export type InsertPropertyUnit = z.infer<typeof insertPropertyUnitSchema>;
export type OptimizationReport = typeof optimizationReports.$inferSelect;
export type InsertOptimizationReport = z.infer<typeof insertOptimizationReportSchema>;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;
export type ScrapedProperty = typeof scrapedProperties.$inferSelect;
export type InsertScrapedProperty = z.infer<typeof insertScrapedPropertySchema>;
export type ScrapedUnit = typeof scrapedUnits.$inferSelect;
export type InsertScrapedUnit = z.infer<typeof insertScrapedUnitSchema>;
