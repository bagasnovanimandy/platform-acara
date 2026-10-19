import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@Roles('SUPER_ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
