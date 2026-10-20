import { Global, Module } from '@nestjs/common';
import { ScopeService } from '../scope/scope.service.js';
import { AcaraClient } from './acara.client.js';
import { CoreClient } from './core.client.js';

@Global()
@Module({
  providers: [CoreClient, AcaraClient, ScopeService],
  exports: [CoreClient, AcaraClient, ScopeService],
})
export class ClientsModule {}
