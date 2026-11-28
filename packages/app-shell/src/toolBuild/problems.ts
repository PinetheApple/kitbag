export class Problems {
  readonly list: string[] = [];

  check(ok: boolean, problem: string): boolean {
    if (!ok) this.list.push(problem);
    return ok;
  }

  add(problem: string): void {
    this.list.push(problem);
  }
}
