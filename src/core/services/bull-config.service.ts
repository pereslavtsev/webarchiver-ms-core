import { Inject, Injectable } from '@nestjs/common';
import { SharedBullConfigurationFactory } from '@nestjs/bull';
import * as Bull from 'bull';
import { ConfigType } from '@nestjs/config';
import bullConfig from '../config/bull.config';
import { CoreProvider } from '../core.provider';
import { Bunyan, RootLogger } from '@eropple/nestjs-bunyan';

@Injectable()
export class BullConfigService
  extends CoreProvider
  implements SharedBullConfigurationFactory
{
  constructor(
    @RootLogger() rootLogger: Bunyan,
    @Inject(bullConfig.KEY)
    private config: ConfigType<typeof bullConfig>,
  ) {
    super(rootLogger);
  }

  createSharedConfiguration(): Bull.QueueOptions {
    return {
      redis: this.config.url as unknown,
    };
  }
}
