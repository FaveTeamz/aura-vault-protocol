import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { requireOperations } from "../middleware/operationsMiddleware.js";
import { searchEvents } from "../services/eventSearchService.js";

export const eventsRouter = Router();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

function singleString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validIsoDate(value: string): boolean {
  const dateMatch = ISO_DATE.exec(value);
  const dateTimeMatch = ISO_DATE_TIME.exec(value);
  const match = dateMatch ?? dateTimeMatch;
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year === 0 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;
  const offset = /([+-])14:(\d{2})$/.exec(value);
  if (offset && offset[2] !== "00") return false;
  if (dateTimeMatch && Number.isNaN(Date.parse(value))) return false;
  return true;
}

function normalizeDate(value: string, endOfDate = false): string {
  if (!ISO_DATE.test(value)) return value;
  return endOfDate ? `${value}T23:59:59.999999Z` : `${value}T00:00:00.000000Z`;
}

function parsePositiveDecimalInteger(value: unknown, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

eventsRouter.get(
  "/search",
  authenticate,
  requireOperations,
  async (req: Request, res: Response): Promise<void> => {
    const rawQuery = singleString(req.query.q);
    const q = rawQuery?.trim();
    if (!q || q.length > 200) {
      res.status(400).json({ error: "q must be a non-empty string of at most 200 characters" });
      return;
    }

    const page = parsePositiveDecimalInteger(req.query.page, 1);
    const pageSize = parsePositiveDecimalInteger(req.query.pageSize, 20);
    if (page === undefined || pageSize === undefined || pageSize > 100) {
      res.status(400).json({ error: "page must be positive and pageSize must be between 1 and 100" });
      return;
    }
    const offset = (page - 1) * pageSize;
    if (!Number.isSafeInteger(offset)) {
      res.status(400).json({ error: "page and pageSize produce an unsafe pagination offset" });
      return;
    }

    const rawType = singleString(req.query.type);
    const type = rawType?.trim();
    if ((req.query.type !== undefined && (!type || type.length > 100)) ||
        (req.query.type !== undefined && rawType === undefined)) {
      res.status(400).json({ error: "type must be a string of at most 100 characters" });
      return;
    }

    const rawFrom = singleString(req.query.from);
    const rawTo = singleString(req.query.to);
    if ((req.query.from !== undefined && rawFrom === undefined) ||
        (req.query.to !== undefined && rawTo === undefined) ||
        (rawFrom !== undefined && !validIsoDate(rawFrom)) ||
        (rawTo !== undefined && !validIsoDate(rawTo))) {
      res.status(400).json({ error: "from and to must be ISO dates or ISO date-times with a timezone" });
      return;
    }

    const from = rawFrom ? normalizeDate(rawFrom) : undefined;
    const to = rawTo ? normalizeDate(rawTo, true) : undefined;
    if (from && to && Date.parse(from) > Date.parse(to)) {
      res.status(400).json({ error: "from must be before or equal to to" });
      return;
    }

    try {
      const result = await searchEvents({
        q,
        type,
        from,
        to,
        page,
        pageSize,
      });
      res.json(result);
    } catch (error) {
      console.error("[events/search]", error);
      res.status(500).json({ error: "Unable to search contract events" });
    }
  }
);
