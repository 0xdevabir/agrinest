import { Controller, Get, Param } from "@nestjs/common";
import { agronomyBody, fetchYield } from "../clients/services";
import { asRecord } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { estimateYield } from "../engines/yield.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class YieldController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("fields/:fieldId/yield")
  async estimate(@Param("fieldId") fieldId: string) {
    const field = await this.fields.require(fieldId);
    const events = await this.db.event.findMany({ where: { fieldId } });
    const mapped = events.map((event) => ({
      id: event.id,
      type: event.type,
      payload: asRecord(event.payload),
      createdAt: event.createdAt,
    }));
    const remote = await fetchYield({
      crop: field.crop,
      variety: field.variety,
      area_ha: field.areaHa,
      events: agronomyBody({
        crop: field.crop,
        variety: field.variety,
        areaHa: field.areaHa,
        sowingDate: field.sowingDate,
        district: field.farmer.district,
        lat: field.lat,
        lon: field.lon,
        forceSeed: false,
        events: mapped,
      }).events,
    });
    if (remote) return remote;
    return estimateYield(
      field.crop,
      field.variety,
      field.areaHa,
      mapped.map((event) => ({ type: event.type, payload: event.payload, createdAt: event.createdAt })),
    );
  }
}
