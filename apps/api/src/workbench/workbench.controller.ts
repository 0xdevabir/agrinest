import { Controller, Get, Param, Query } from "@nestjs/common";
import { queryBool } from "../common/paths";
import { asRecord } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
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
    const weather = await getWeather(field.lat, field.lon, queryBool(forceSeed, true));
    return buildWorkbench({
      crop: field.crop,
      variety: field.variety,
      areaHa: field.areaHa,
      sowingDate: field.sowingDate,
      district: field.farmer.district,
      weather,
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        payload: asRecord(event.payload),
        createdAt: event.createdAt,
      })),
      listings: listings.map((item) => ({
        id: item.id,
        quantityTon: item.quantityTon,
        district: item.district,
        crop: item.crop,
      })),
    });
  }
}
