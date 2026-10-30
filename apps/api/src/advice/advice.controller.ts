import { Controller, Get, Param, Query } from "@nestjs/common";
import { queryBool } from "../common/paths";
import { eventOut, jsonValue } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { buildAdvice } from "../engines/advice.engine";
import { getWeather } from "../engines/weather.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class AdviceController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("fields/:fieldId/advice/today")
  async today(
    @Param("fieldId") fieldId: string,
    @Query("force_seed_weather") forceSeed?: string,
    @Query("persist") persist?: string,
  ) {
    const field = await this.fields.require(fieldId);
    const weather = await getWeather(field.lat, field.lon, queryBool(forceSeed, false));
    const advice = buildAdvice(field.crop, field.sowingDate, weather);
    const shouldPersist = queryBool(persist, true);
    const event = shouldPersist
      ? await this.db.event.create({ data: { fieldId, type: "advice", payload: jsonValue(advice) } })
      : null;
    return {
      ...advice,
      event: event
        ? eventOut(event)
        : { id: "ephemeral-advice", field_id: fieldId, type: "advice", payload: advice, created_at: null },
    };
  }
}

