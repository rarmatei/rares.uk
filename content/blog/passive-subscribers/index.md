---
title: RxJS — passive subscribers
date: "2017-11-25T21:24:25.454Z"
description: 'How do you silently subscribe/unsubscribe to an observable without generating all the normal side effects like start-up/teardown logic?'
---

![a cat passively watching a squirrell behind a window](./passive_cat.jpg)

Let’s assume there is a service that exposes a `startItUp():Observable<Graph>` API endpoint. Whenever a consumer subscribes to this, a bunch of heavy requests are made to the server, and returned data is packaged for the subscriber.

What if we want to add some passive listeners to the above event? What if we want an API `passiveState():Rx.Observable<Graph>` that doesn’t trigger any of those heavy server requests, and instead waits patiently for somebody else to trigger them?

What if I wrote an actual example rather than asking all these nonsensical rhetorical questions:

- **Subscriber1** goes: `service.passiveState().subscribe(x => ...)`
- *Time passes and nothing happens. No network requests are being triggered…*
- **Subscriber2** then goes: `service.startItUp().subscribe(x => ...)`
- *A network request is triggered and a heavy JSON object starts downloading…*
- When the above object downloads both **Subscriber1** and **Subscriber2** now get the data

#### tldr; We want a pattern for passively listening to values flowing through another observable, without affecting its start-up/teardown cycle.

And here’s the code:

```javascript 

class MyService {

  constructor() {
    this._producer = Rx.Observable.interval(1000)
      .publish();
  }

  private _producer: Rx.ConnectableObservable<number>;

  startItUp(): Rx.Observable<number> {
    return this._producer.refCount();
  }

  get passiveValues(): Rx.Observable<string> {
    return this._producer.mapTo("foo");
  }
}

// USAGE

const service = new MyService();
let subscription: Rx.Subscription;

service.passiveValues
  .subscribe(x => console.log(`Passive value: ${x}`));

setTimeout(() => {
  console.log("START TIMER FIRED");
  subscription = service.startItUp()
    .subscribe(x => console.log(`active starter: ${x}`));
}, 5000);

setTimeout(() => {
  console.log("END TIMER FIRED");
  subscription.unsubscribe();
}, 8000);

// OUTPUT

/*
START TIMER FIRED
Passive value: foo
active starter: 0
Passive value: foo
active starter: 1
END TIMER FIRED
*/

```

The “magic” lies in separating the [`publish()`](https://rxjs.dev/api/operators/publish) from the [`refCount()`](https://rxjs.dev/api/operators/refCount) (links attached in case you want to read more about them). The `publish()` gives us a [“lever”](https://rxjs.dev/api/index/class/ConnectableObservable#connect-) to explicitly control when to start-up and tear-down its source observable (in this case `Rx.Observable.interval(1000)`).

Because that lever is initially **off**, regardless of how many subscribers to the passive API we get, no values will flow through.

However, when somebody subscribers to `startItUp()`, `refCount()` will automatically turn that lever to **on**, opening the gate and starting up the interval.

Because both `startItUp()` and `passiveValues` use the same shared source, they’ll both start getting getting once the `publish()` lever is turned **on**.

What’s cool, is if we suddenly stop having subscribers to `startItUp()`, the `passive` subscribers will stop receiving values too (a behavior of `refCount()`).

---

What about if we want to delay opening the gate until the first subscriber to `startItUp()` (so, what we did above) but we never want it to close after? We’d have to get rid of `refCount()`, and manually call `connect()`:

```javascript
class MyService {

  constructor() {
    this._producer = Rx.Observable.of(1)
      .publish();
  }

  private _producer: Rx.ConnectableObservable<number>;

  startItUp(): Rx.Observable<number> {
    this._producer.connect();
    return this._producer;
  }

  get passiveValues(): Rx.Observable<string> {
    return this._producer.mapTo("got value");
  }
}
```

However, run the above and you’d get a very undesirable output:

```
START TIMER FIRED
Passive value: got value
END TIMER FIRED
```

That’s because of the default synchronous nature of RxJS: when we call `this._producer.connect()` the subscription chain of the producer is instantly called, and the value gets emitted. By the time we return the producer on line 12, it’s too late, as the value was missed. The `passive` gets the value, because they were subscribed for quite some time, and were ready for it.

---

Solution, `subscribe` before calling `connect()`:

```javascript

class MyService3 {

  constructor() {
    this._producer = Rx.Observable.of(1)
      .publish();
  }

  private _producer: Rx.ConnectableObservable<number>;

  startItUp(): Rx.Observable<number> {
    return Rx.Observable.create(obs => {
      const subs = this._producer.subscribe(obs);
      this._producer.connect();
      return subs;
    });
  }

  get passiveValues(): Rx.Observable<string> {
    return this._producer.mapTo("got value");
  }
}

```

Now, whenever somebody subscribes to `startItUp()` we first create a `subscription` to the producer, before calling `connect()`. That way we ensure we don’t lose a value:

```
START TIMER FIRED
Passive value: got value
active starter: 1
END TIMER FIRED
```

---

Here’s the code on Stackblitz if you want to play around with it: https://stackblitz.com/edit/angular-idbbzf (app/app.component.ts)