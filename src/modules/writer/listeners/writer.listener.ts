import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { LoggableProvider } from '@pereslavtsev/webarchiver-misc';
import { Bunyan, RootLogger } from '@eropple/nestjs-bunyan';
import { InjectWriterQueue } from '../writer.decorators';
import { Queue } from 'bull';
import { OnTask, Task, TasksService } from '@core/tasks';
import { OnSource, Source } from '@core/sources';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class WriterListener
  extends LoggableProvider
  implements OnApplicationBootstrap
{
  constructor(
    @RootLogger() rootLogger: Bunyan,
    @InjectWriterQueue() private writerQueue: Queue<Task>,
    private tasksService: TasksService,
    private eventEmitter: EventEmitter2,
  ) {
    super(rootLogger);
  }

  async onApplicationBootstrap() {
    const tasks = await this.tasksService.checkAllForArchived();
    tasks.forEach((task) => this.eventEmitter.emit('task.archived', task));
    await this.writerQueue.addBulk(
      tasks.map((task) => ({
        data: task,
        opts: {
          jobId: task.id,
        },
      })),
    );
  }

  @OnTask.Archived()
  async handleTaskArchivedEvent(task: Task): Promise<void> {
    await this.writerQueue.add(task, { jobId: task.id });
  }

  private x = 0;

  @OnEvent('source.*')
  async handleSourceArchivedEvent(source: Source): Promise<void> {
    const { status } = source;

    switch (status) {
      case Source.Status.ARCHIVED:
      case Source.Status.DISCARDED:
      case Source.Status.FAILED: {
        this.x++;
        console.log('ccc', this.x);
        const task = await this.tasksService.checkForArchived(source.taskId);
        if (!task || task.status !== Task.Status.ARCHIVED) {
          return;
        }
        this.eventEmitter.emit('task.archived', task);
      }
    }
  }
}
