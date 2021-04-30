---
title: WIP - What are Reactive Variables in Apollo Client 3?
date: "2021-04-29T21:24:25.454Z"
description: 'Apollo Client gives you a powerful local cache that stores chunks of your backend graph and efficiently updates your UI when it changes. But did you know you can also use that cache to store client side only state? The new Reactive Variables in Apollo Client V3 make that super easy!'
---

Are you using Apollo client to build GraphQL queries that re-render your state when mutations happen?

```javascript
const { data } = useQuery(
    gql`
      query {
        quotes {
          id
          message
        }
      }
    ` 
);
return <div>{data.quotes[0].message}</div>;
```

Not all data needs to come from the server. You will probably have some state that lives just on the client.

What if you could use the same GraphQL-like pattern to query client side state as well? Components get the freedom to specify exactly
the shape of data they need, and whenever any property of any of the entities they're interested changes, we get guaranteed re-renders. Pretty neat!

##### Local state

##### Reactive variables

##### Using Reactive variables in your client-side graph

[Link to Sandbox](https://codesandbox.io/s/apollo-reactive-variables-8s3h8?file=/src/App.js)

##### Can we take this further?

Our existing setup is nice because components can query the cache and construct their state however they like
without worrying if that state comes from the client or from the server.
But if they want to request changes to that data, they have to either create a mutation (for server data) or update the reactive
variables (for client data). So they still have to know where that data comes from when it comes to updating it.

Stay tuned for the next article, where we'll look at how to abstract away the logic of updating your Reactive Variables inside
a **mutation field policy**, after which components will be able to always and consistently make GraphQL mutations 
for updating entities, without caring whether the data they're updating is server or client-side.
