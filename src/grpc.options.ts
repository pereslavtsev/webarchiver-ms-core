import { Transport, ClientOptions } from '@nestjs/microservices';
import { tasks } from '@pereslavtsev/webarchiver-protoc';
import { resolve } from 'path';

const port = process.env.PORT || 10001;

export const grpcClientOptions: ClientOptions = {
  transport: Transport.GRPC,
  options: {
    url: `0.0.0.0:${port}`,
    package: tasks.protobufPackage,
    protoPath: resolve(
      'node_modules',
      '@pereslavtsev/webarchiver-protoc',
      'dist',
      'proto',
      `webarchiver.proto`,
    ),
    loader: {
      includeDirs: [
        resolve(
          'node_modules',
          '@pereslavtsev/webarchiver-protoc',
          'dist',
          'proto',
        ),
      ],
    },
  },
};