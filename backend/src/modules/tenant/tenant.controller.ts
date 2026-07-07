import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':tenantCode')
  findOne(@Param('tenantCode') tenantCode: string) {
    return this.tenantService.findByTenantCode(tenantCode);
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      tenantCode: string;
      slug: string;
      adminEmail: string;
      contactName?: string;
      contactPhone?: string;
      remark?: string;
    },
  ) {
    return this.tenantService.create(body);
  }

  @Patch(':tenantCode/status')
  updateStatus(
    @Param('tenantCode') tenantCode: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' },
  ) {
    return this.tenantService.updateStatus(tenantCode, body.status);
  }
}
