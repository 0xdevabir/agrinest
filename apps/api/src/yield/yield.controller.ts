import { Controller, Get, Param } from "@nestjs/common";
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
    return estimateYield(
      field.crop,
      field.variety,
      field.areaHa,
      events.map((event) => ({ type: event.type, payload: asRecord(event.payload), createdAt: event.createdAt })),
    );
  }
}
