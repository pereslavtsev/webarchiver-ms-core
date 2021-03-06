import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { tasks } from '@pereslavtsev/webarchiver-protoc';
import { LoggableProvider } from '@pereslavtsev/webarchiver-misc';
import { Bunyan, RootLogger } from '@eropple/nestjs-bunyan';
import { TasksService } from '../services';
import { CreateTaskDto, CancelTaskDto, GetTaskDto, ListTasksDto } from '../dto';
import { from, Observable, Subject } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { Task } from '@core/tasks';

const { TasksServiceControllerMethods } = tasks;
type TasksSubscriptionsMap = Map<Task['id'], Subject<Task>>;

@Controller('tasks')
@TasksServiceControllerMethods()
export class TasksController
  extends LoggableProvider
  implements tasks.TasksServiceController
{
  protected readonly subscriptions: TasksSubscriptionsMap = new Map();

  constructor(
    @RootLogger() rootLogger: Bunyan,
    private tasksService: TasksService,
  ) {
    super(rootLogger);
  }

  @OnEvent('task.*')
  handleTasksEvents(task: Task) {
    const subject = this.subscriptions.get(task.id);
    if (!subject) {
      return;
    }

    subject.next(task);

    switch (task.status) {
      case Task.Status.DONE:
      case Task.Status.FAILED:
      case Task.Status.SKIPPED:
      case Task.Status.CANCELLED: {
        subject.complete();
        this.subscriptions.delete(task.id);
      }
    }
  }

  @UsePipes(new ValidationPipe())
  getTaskStream({ id }: GetTaskDto): Observable<Task> {
    if (!this.subscriptions.has(id)) {
      this.subscriptions.set(id, new Subject());
    }

    const subject = this.subscriptions.get(id);

    return subject.asObservable();
  }

  @UsePipes(new ValidationPipe())
  createTaskStream({ pageId }: CreateTaskDto): Observable<Task> {
    const subject = new Subject<Task>();

    from(this.tasksService.create(pageId)).subscribe((task) => {
      if (!this.subscriptions.has(task.id)) {
        this.subscriptions.set(task.id, subject);
      }
      subject.next(task);
    });

    return subject.asObservable();
  }

  @UsePipes(new ValidationPipe())
  async listTasks({
    pageSize,
    pageToken,
    orderBy,
  }: ListTasksDto): Promise<tasks.ListTasksResponse> {
    const { data, cursor } = await this.tasksService.findAll({
      pageSize,
      pageToken,
      orderBy,
    });
    return {
      data,
      nextPageToken: cursor.afterCursor,
    };
  }

  @UsePipes(new ValidationPipe())
  async createTask({ pageId }: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(pageId);
  }

  @UsePipes(new ValidationPipe())
  getTask({ id }: GetTaskDto): Promise<Task> {
    return this.tasksService.findById(id);
  }

  @UsePipes(new ValidationPipe())
  cancelTask({ id }: CancelTaskDto): Promise<Task> {
    return this.tasksService.setCancelled(id);
  }
}
