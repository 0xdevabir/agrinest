import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateFieldDto } from "./dto/create-field.dto";
import { FieldsService } from "./fields.service";

@Controller("fields")
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Post()
  create(@Body() body: CreateFieldDto) {
    return this.fields.create(body);
  }

  @Get()
  list(@Query("farmer_id") farmerId?: string) {
    return this.fields.list(farmerId);
  }

  @Get(":fieldId")
  get(@Param("fieldId") fieldId: string) {
    return this.fields.get(fieldId);
  }

  @Get(":fieldId/events")
  events(@Param("fieldId") fieldId: string) {
    return this.fields.events(fieldId);
  }

  @Post(":fieldId/events")
  append(@Param("fieldId") fieldId: string, @Body() body: CreateEventDto) {
    return this.fields.append(fieldId, body);
  }
}
