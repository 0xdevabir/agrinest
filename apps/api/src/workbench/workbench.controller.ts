import { Controller, Get, Param, Query } from "@nestjs/common";
import { agronomyBody, fetchDesk } from "../clients/services";
import { queryBool } from "../common/paths";
import { asRecord } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { marketDesk } from "../engines/market.engine";
import { getWeather } from "../engines/weather.engine";
import { buildWorkbench } from "../engines/workbench.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class WorkbenchController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("fields/:fieldId/workbench")
  async workbench(@Param("fieldId") fieldId: string, @Query("force_seed_weather") forceSeed?: string) {
    const field = await this.fields.require(fieldId);
    const [events, listings] = await Promise.all([
      this.db.event.findMany({ where: { fieldId } }),
      this.db.listing.findMany({ where: { fieldId } }),
    ]);
    const mapped = events.map((event) => ({
      id: event.id,
      type: event.type,
      payload: asRecord(event.payload),
      createdAt: event.createdAt,
    }));
    const listingRows = listings.map((item) => ({
      id: item.id,
      quantityTon: item.quantityTon,
      district: item.district,
      crop: item.crop,
    }));
    const seed = queryBool(forceSeed, true);
    const desk = await fetchDesk(
      agronomyBody({
        crop: field.crop,
        variety: field.variety,
        areaHa: field.areaHa,
        sowingDate: field.sowingDate,
        district: field.farmer.district,
        lat: field.lat,
        lon: field.lon,
        forceSeed: seed,
        events: mapped,
      }),
    );
    if (desk) {
      const cap = Number(desk.yield.mid ?? 0);
      return {
        precision: desk.precision,
        yield: desk.yield,
        climate: desk.climate,
        guardian: desk.guardian,
        market: marketDesk(field.farmer.district, cap, listingRows),
        services: { agronomy: "agronomy", market: "nest" },
      };
    }
    const weather = await getWeather(field.lat, field.lon, seed);
    return {
      ...buildWorkbench({
        crop: field.crop,
        variety: field.variety,
        areaHa: field.areaHa,
        sowingDate: field.sowingDate,
        district: field.farmer.district,
        weather,
        events: mapped,
        listings: listingRows,
      }),
      services: { agronomy: "nest-fallback", market: "nest" },
    };
  }
}
