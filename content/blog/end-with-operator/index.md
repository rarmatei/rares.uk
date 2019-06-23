---
title: Building an RxJS .endWith() operator
date: "2017-04-23T21:24:25.454Z"
description: 'Here I investigate different ways of achieving .endWith() functionality in RxJS'
---

> This post was originally written on Apr. 23rd 2017. Since then an [endWith](https://rxjs.dev/api/operators/endWith) operator has been officially added to the library.
> I'll leave it here though for posterity though as my first tech blog post.

In RxJS, there’s a [startWith](https://rxjs.dev/api/operators/startWith) operator that emits the items you specify as arguments before it starts emitting from the source observable.

Recently, I’ve run across a use-case where I need to emit one final item before letting the observable complete: an `endWith` operator.

It would look like the below:

```javascript
Rx.Observable
  .interval(100)
  .take(2)
  .endWith(999)
  .subscribe(
    (x) => console.log(x),
    (err) => console.error(err),
    () => console.log("complete")
  );

// Will log:
// 0
// 1
// 999
// complete
```

And to get straight to the point, here’s the implementation I came up with:

```javascript
Rx.Observable.prototype.endWith = function(finalValue) {
  return new Rx.Observable((observer) => {
    const endWithObserver = {
      next: (x) => observer.next(x),
      error: (err) => observer.error(err),
      complete: () => {
        observer.next(finalValue);
        observer.complete();
      }
    };
    return this.subscribe(endWithObserver);
  });
}
```

Here’s a [working CodePen](https://codepen.io/rarmatei/pen/vmEoNg?editors=0010) for the above.

Have a look at the [“Learning Observable by Building Observable”](https://medium.com/@benlesh/learning-observable-by-building-observable-d5da57405d87) article by [Ben Lesh](https://twitter.com/BenLesh) for a more in-depth explanation on observables and you can create new operators.

---

But what about if we don’t want to build a new operator and want to use existing methods?

### The .let() operator

Right after I posted this article, [Ashley Claymore](https://twitter.com/acutmore) gave the following example of using the **.let()** operator to achieve **endWith** functionality:

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">and build with composition:<br><br>const endWith = v =&gt; src =&gt; src.concat(Rx.Observable.of(v))<br><br>obs.let(endWith(1))</p>&mdash; Ashley Claymore (@acutmore) <a href="https://twitter.com/acutmore/status/856252842235047936?ref_src=twsrc%5Etfw">April 23, 2017</a></blockquote>

So unless you want to create a dedicated operator, as I showed you above, to make your stream look slightly nicer:

`obs.endWith(1) vs.obs.let(endWith(1))`

..I’d highly recommend the above approach, as it’s much much simpler.

### Old fashioned Rx.Observable.create()

Below is the solution that first came to my mind when thinking about this operator. I used the `.create()` method to get access to the internal observer of my stream. Internally, I then subscribe to my main producer, and when the complete method is called, right before I call `.complete()` I do a `.next(finalValue)` on my observer:

```javascript
Rx.Observable.create(observer => {
    return Rx.Observable
      .interval(100)
      .take(2)
      .subscribe(
        (value) => observer.next(value),
        (err) => observer.error(err),
        () => {
          observer.next(999);
          observer.complete();
        });
  });
```

And a working [CodePen](http://codepen.io/rarmatei/pen/EmaqNx?editors=0010).

### Materialize / Dematerialize

A really interesting operator that grabbed my attention while looking for existing ways to implement `endWith` functionality was `.materialize()`. The [materialize](https://rxjs.dev/api/operators/materialize) operator maps each event **(next, error and complete)** emitted by the source observables into [notifications](http://reactivex.io/rxjs/class/es6/Notification.js~Notification.html). Here’s an example situation (live [CodePen](https://codepen.io/rarmatei/pen/VbLZPd?editors=0012)):

```javascript
Rx.Observable.interval(100)
  .take(2)
  .materialize()
  .subscribe(
    (x) => console.log(`Next: ${x.kind} ${x.value}`),
    null,
    () => console.log("Complete") 
);
```

Two of the properties a notification object has are `kind` and `value`. Value is the actual value being emitted, while `kind` is the type of notification: **“N”** for next, **“C”** for completed and **“E”** for error. For normal *next* notifications, `.materialize()` simply wraps the value in a notification, so **“6”** becomes `{kind:”N”, value:6}`. However, for *next* and *error* events, it first emits a notification, and then calls **complete()** on the observer:

```javascript
const destination = this.destination;
destination.next(Notification.createComplete());
destination.complete();
```

So you can start to see where I’m going with this: using `.materialize()`, we can spy on the different events being emitted, and once we see a *completed* event we can instead emit our final value, because we know that right after that notification, our observable will complete.

```javascript
Rx.Observable
  .interval(1000)
  .take(2)
  .materialize()
  .map((value) => {
    return value.kind === "C"
      ? Rx.Notification.createNext(finalValue)
      : value;
  });
```

You might be wondering at this point what do we do with those notifications after we’ve done spying on their types. Well, thankfully there’s a `.dematerialize()` operator that takes care of converting those notifications back into simple values for us to use.

Here’s the full example of what I just discussed (+ [CodePen](http://codepen.io/rarmatei/pen/JWppmp?editors=0000)):

```javascript
var finalValue = 999;
Rx.Observable
  .interval(1000)
  .take(2)
  .materialize()
  .map((value) => {
    return value.kind === "C"
      ? Rx.Notification.createNext(finalValue)
      : value;
  })
  .dematerialize()
  .subscribe(
    x => console.log(x), 
    () => console.log("error"),
    () => console.log("complete")
  );
  ```

  Note that I’m transforming the *complete* notification into just another *next* notification, but it still works and completes as expected. That’s normal, because observables don’t complete based on the notification type they receive, they complete because something invoked the `.complete()` function on their observer. So when `.take(2)` finished taking 2 elements it calls `.complete()` on its observer, **materialize** “notices” this and first does a simple *next* on its observer with the *complete* notification, then calls the `.complete()` method on its observer.

### Conclusion

Please comment below any thoughts, questions or criticism you might have. I wrote this article to push myself to understand some RxJS concepts better so I’d love to hear of I’ve missed anything important or I got something completely backwards.