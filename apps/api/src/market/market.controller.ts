import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { asRecord, jsonValue, listingOut } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { marketHint, pricesForDistrict } from "../engines/market.engine";
import { estimateYield } from "../engines/yield.engine";
import { FieldsService } from "../fields/fields.service";
import { CreateListingDto } from "./dto/create-listing.dto";

@Controller()
export class MarketController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("markets/prices")
  prices(@Query("district") district = "রংপুর") {
    return pricesForDistrict(district);
  }

  @Get("fields/:fieldId/market-hint")
  async hint(@Param("fieldId") fieldId: string) {
    const field = await this.fields.require(fieldId);
    return marketHint(field.farmer.district);
  }

  @Post("fields/:fieldId/listings")
  async create(@Param("fieldId") fieldId: string, @Body() body: CreateListingDto) {
    const field = await this.fields.require(fieldId);
    const events = await this.db.event.findMany({ where: { fieldId } });
    const estimate = estimateYield(
      field.crop,
      field.variety,
      field.areaHa,
      events.map((event) => ({ type: event.type, payload: asRecord(event.payload), createdAt: event.createdAt })),
    );
    if (body.quantity_ton > estimate.mid + 1e-6) {
      throw new BadRequestException(
        `পরিমাণ বেশি—আনুমানিক ফলন ${estimate.mid.toFixed(2)} টন পর্যন্ত তালিকাভুক্ত করতে পারবেন`,
      );
    }
    const listing = await this.db.listing.create({
      data: {
        fieldId,
        crop: field.crop,
        quantityTon: body.quantity_ton,
        priceHintBdt: body.price_hint_bdt ?? null,
        district: field.farmer.district,
        notes: body.notes ?? null,
      },
    });
    await this.db.event.create({
      data: {
        fieldId,
        type: "sale",
        payload: jsonValue({
          quantity_ton: body.quantity_ton,
          price_hint_bdt: body.price_hint_bdt ?? null,
          notes: body.notes ?? null,
        }),
      },
    });
    return listingOut(listing);
  }

  @Get("listings")
  async listings(@Query("district") district?: string) {
    const rows = await this.db.listing.findMany({
      where: district ? { district } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(listingOut);
  }
}

