import { Global, Module } from '@nestjs/common';
import { CoreClient } from './core.client.js';
import { ScopeService } from '../scope/scope.service.js';

@Global()
@Module({ providers: [CoreClient, ScopeService], exports: [CoreClient, ScopeService] })
export class CoreModule {}
