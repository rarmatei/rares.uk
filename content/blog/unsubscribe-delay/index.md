---
title: RxJS - Unsubscribe delay
date: "2017-10-22T21:24:25.454Z"
description: 'Sharing an observable is amazingly useful. But sometimes we might want to keep the subscription alive for a few seconds even after all listeners have unsubscribed.'
---

Last time I published [an investigation on RxJS](https://rares.uk/end-with-operator/) Matthew Podwysocki gave me a one-line alternative to essentially my whole article:

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">why wouldn&#39;t you just use .concat to add values to the end?</p>&mdash; λ Calrissian (@mattpodwysocki) <a href="https://twitter.com/mattpodwysocki/status/857309781417185281?ref_src=twsrc%5Etfw">April 26, 2017</a></blockquote>

So here’s hoping that somebody notices a ridiculously simple solution this time as well, as I’d be super interested!

---

Observables are great. You can share an underlying producer to multiple subscribers, and you can set it up with a `refCount()` so that it only initiates itself when it has at least 1 subscriber and then it tears itself down when it goes back down to 0 subscribers.

Imagine, however, that we have a very expensive observable (maybe a `combineLatest()` of about 5 different web socket connections). Now imagine this is only needed on **PageOrange** and **PagePeach** of our application, but **not PageOnion** (it’s a fruit app, I’m just setting the scene).

We navigate to **PageOrange**, it calls subscribe on the **observable** and then we change our mind and go to **PageOnion**. We’ll obviously want to call `.unsubscribe()` on our subscription, as we’d be getting updates we’re not interested in. So we setup a mechanism that whenever we enter **PageOrange**, we subscribe, and whenever we leave **PageOrange**, we unsubscribe.

We have the same logic on **PagePeach** as on **PageOrange**: enter events cause a subscription, leave events cause an unsubscribe. So imagine that now we navigate from **PageOrange** to **PagePeach**. The observable will tear down when leaving **PageOrange** and immediately re-initiate itself on enter of **PagePeach**.

Even if we `.share()` the observable it won’t make a difference: it will go back down to zero subscribers before going back to 1 on entering **PagePeach**.

Wouldn’t it be great if we had a `.delayedRefCount(1000)` operator? On reaching 0 subscribers, it would wait 1000ms (to see if it gets any new subscribers), and only then call `unsubscribe()` on its source.

---

My solution below is based on Paul Taylor’s example [here](https://github.com/ReactiveX/rxjs/issues/171#issuecomment-267881847).

### Observable.using()

First, let’s try to re-create the `refCount()` operator, as simply as possible. Main problem: **keeping track of the number of subscriptions**.

Without diving too much into the details, and intentionally avoiding the discussion of all the other possible use-cases for it, `Observable.using()` accepts two parameters: a resource factory and an observable factory (Rx4 [docs link](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/operators/using.md) if you’re interested in the details). Simple example:

```javascript

Rx.Observable.using(
  function resourceFactory() {
    return {
      name: 'my resource',
      unsubscribe() {
        console.log("resource disposed");
      }
    };
  },
  function obsFactory(resource) {
    return Rx.Observable.of(resource.name);
  }
)
.subscribe(
  (x) => console.log(x)
);

// output:
// my resource
// resource disposed

```

As you can see, the resource created in the factory is closely tied to the lifecycle of the observable. So when the observable gets disposed, the resource gets disposed as well: either its `unsubscribe()` method is called, or if the resource was a function, the whole function is called on disposal.

### Implementing refCount()

Now that we understand how `Observable.using()` works for our purposes, let’s build a `refCount()` clone:

```javascript

function refCount(source) {
  let length = 0;
  const onNewSubscriber = () => {
    const onUnsubscribe = () => {
      length--;
      if(length === 0) {
        source.connect().unsubscribe();
      }
    };
    length++;
    if(length === 1) {
      source.connect();
    }
    return onUnsubscribe;
  };
  const obs = () => source;
  return Rx.Observable.using(onNewSubscriber, obs);
}

const source = Rx.Observable
  .interval(1000)
  .take(10)
  .publishReplay(1)
  .let(refCount);

```

With `using()` we basically get access to a function `resource()` that gets called whenever we have a new subscription. From that function we can then return another function `newSubs()` that will get called when that subscription is disposed.

With the above setup, we can simply setup a counter `length` that counts our subscriptions. When we get a new subscription, if `length === 1` then it’s the first one, so we call `.connect()` on our source. On an unsubscribe, if `length === 0` then there are no more subscriptions, so we can `.unsubscribe()` from the source.

As for the observable factory function, we’re just returning the source. We’re not interested in the resource (as opposed to the first example). We simply want to pass the source downwards, so it can send notifications to subscribers.

We’re essentially hijacking the `using()` operator, and using its logic just so we can keep track of the number of subscribers. I’ve even completely removed all traces of the word `resource` and replaced them with convenient `onNewSubscriber` and `onUnsubscribe` functions.

### delayedRefCount(delay) — AKA “finally, the good stuff”

I’ll go straight to the point:

```javascript

function delayedRefCount(delay) {
  return (source) => {
    let length = 0;
    let timeout;
    const onNewSubscriber = () => {
      const onUnsubscribe = () => {
        length--;
        if (length === 0) {
          timeout = setTimeout(() => {
            source.connect().unsubscribe();
          }, delay);
        }
      };
      length++;
      if (length === 1) {
        source.connect();
      }
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      return onUnsubscribe;
    };
    const obs = () => source;
    return Rx.Observable.using(onNewSubscriber, obs);
  };
}

const source = Rx.Observable
  .interval(1000)
  .do(x => console.log(x))
  .take(10)
  .publishReplay(1)
  .let(delayedRefCount(3000));

```

It’s beefy! But it has to be. Another more Rx-y variant is below. But first let’s go over what’s happening above.

It’s the same idea as before, only now we have a `setTimeout`. When the subscriber count goes back to zero, we start the timeout. If nobody subscribes within the timeout delay, we call unsubscribe on the source.

If we do get another subscriber, we check if there’s an active `timeout` and we cancel it, so it doesn’t dispose of our producer.

If you thought something looked weird it’s probably this: `source.connect().unsubscribe()`. Surely we want to dispose of the connection. Why would we call `connect()`? The way connect() works is it returns the existing connection if it’s already connected. So we don’t need to keep track of that subscription as well, we can just call `connect()` to either..connect OR to grab the existing connection (to unsubscribe from it).

We then take advantage of the `let()` operator when using it. Here are some Rx4 [docs](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/operators/let.md) for let.

The above is enough to achieve our goal: **if we go to zero to one subscribers within a short period of time, our producer won’t get teared down.**

### More Rx-y approach

While the above is easier to understand, we do have to manage the lifecycle of our `setTimeout` ourselves. If observables are really good at something, it’s managing async events.

Imagine we have an observable `subscribeUpdates` that emits 1 if we got a new subscriber, and -1 if we lost a subscriber. Now consider the below:

```javascript
subscribeUpdates
  .scan((total, change) => change + total, 0)
  .switchMap(count => {
    return count === 0
      ? Observable.timer(delay)
        .do(_ => /* tear-down logic */ )
      : Observable.never();
});
```

By adding the `.scan()` we can get a running count of the number of active subscribers. Then, we jump into the `switchMap()` where we check the number of subscribers. If it’s zero, then we return a timed observable that fires after `delay` has passed. Once it fires, we can initiate the source disposal in the `do()` block.

However, if while the timer is active we get a new subscriber, and the count goes from 0 to 1, we **switch** to a completely different observable (one that never emits a value) and dispose of the old one, meaning the timer will never fire. This is the main benefit of using this approach: RxJS takes care of managing our timers. [Rx5 Docs on switchMap](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html#instance-method-switchMap).

Here’s the full version:

```javascript
function delayedRefCount(delay) {
  return (source) => {
    const subscribeUpdates = new Subject();
    let trackerConnection;
    let subscriptionTracker = subscribeUpdates.scan((total, change) => change + total, 0)
      .switchMap(count => {
        return count === 0
          ? Observable.timer(delay)
            .do(_ => source.connect().unsubscribe() || trackerConnection.unsubscribe())
          : Observable.never();
      }).publish();

    const onNewSubscriber = () => {
      source.connect();
      trackerConnection = subscriptionTracker.connect();
      subscribeUpdates.next(1);
      return function onUnsubscribe() {
         subscribeUpdates.next(-1)
      };
    };
    const observable = () => source;
    return Observable.using(onNewSubscriber, observable);
  };
}
```

Now, instead of increasing and decreasing a `length` counter in our new subscriber function, we just fire +1 and -1 `next` updates on the `subscribeUpdates` subject (lines 16 and 17).

You’ll notice something weird in there:

> `subscriptionTracker` has a `publish()` at the end: we need to be in control and start it up and tear it down along with our source, as it’s independent from it. Once we get the first subscriber, we start our `subscriptionTracker` stream (by calling `connect()` on it). When we unsubscribe from the source, we also tear `subscriptionTracker` down as well.

### Conclusion

This was a really good learning experience for myself, and if you have any feedback please comment below!

I’m super interested to hear any questions you might have, feedback on my writing/explanation style and, of course, if you think the above could have been done in a simpler way!

Thanks so much for reading up to this point!