import { Controller, Get, Param, Query } from "@nestjs/common";
import { fetchAdvice } from "../clients/services";
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
    const seed = queryBool(forceSeed, false);
    const remote = await fetchAdvice({
      crop: field.crop,
      sowing_date: field.sowingDate,
      lat: field.lat,
      lon: field.lon,
      district: field.farmer.district,
      force_seed_weather: seed,
    });
    const advice =
      remote ?? buildAdvice(field.crop, field.sowingDate, await getWeather(field.lat, field.lon, seed));
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
