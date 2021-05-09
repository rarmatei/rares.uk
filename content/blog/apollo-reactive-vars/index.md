---
title: What are Reactive Variables in Apollo Client 3?
date: "2021-04-29T21:24:25.454Z"
description: 'Apollo Client gives you a powerful local cache that stores chunks of your backend graph and efficiently updates your UI when it changes. But did you know you can also use that cache to store client side only state? The new Reactive Variables in Apollo Client V3 make that super easy!'
---

Are you using Apollo client to make GraphQL queries?

```javascript
const { data, loading } = useQuery(
    gql`
      query {
        quotes {
          text
        }
      }
    ` 
);
if (loading) {
  return <span>Loading...</span>;
}
return <div>{data.quotes[0].text}</div>;
```

Apollo guarantees that if the value of `quotes` changes in its cache (maybe following a mutation), the component re-renders.

In addition to the above, you will probably have some state that lives just on the client. Maybe you're using Redux for that, or MobX, or keeping in the Context.

What if you could use the same GraphQL-like pattern to query **client side state** as well? 
- Components get the freedom to specify exactly
the shape of data they need (even if that data just comes from somewhere on the client)
- And whenever any property of any of the entities they're interested in changes, we get guaranteed re-renders
  
## Local state

Let's suppose we have a piece of client state, called "bob". Bob is represented by an emoji:

```javascript
export const clientState = {
  bob: "🤔"
};
```

To show Bob's current status above our list of quotes, we'd need to import this state in our component:

```jsx
import { clientState } from "./state";

export default function App() {
  const bob = clientState.bob;
  const { data, loading } = useQuery(
    gql`
      query {
        quotes {
          text
        }
      }
    `
  );
  if (loading) {
    return <span>Loading...</span>;
  }
  return (
    <div className="container">
      What is Bob doing:
      <span className="bob">{bob}</span>
      <span className="quote">{data.quotes[0].text}</span>
    </div>
  );
}
```

This gives us:

![Bob's status](./bob_3.png)

It works! But now our component has to query the server state one way (via a GraphQL query), and the client state another way (by a separate import). 
There's also another problem: **if Bob's status updates, our component doesn't know it has to re-render, so our UI will display stale data.**

## Local State in Apollo

With [Type Policies](https://www.apollographql.com/docs/react/caching/cache-field-behavior/), we can mix-in pieces of local client state in Apollo's cache:

```jsx
export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        bob() {
          return "🤔";
        }
      }
    }
  }
});

const client = new ApolloClient({
  cache,
  uri: "https://some.url/graphql"
});
```

Whenever a component includes "bob" in its GraphQL query, we will return the string `"🤔"` to them.

We used the `Query` type because that defines all the top-level fields in our schema - and we want `bob` to be accessible at the top-level.
But you can attach client state to other types as well. You can have a `Person` type on your backend GraphQL schema, and on the client you can extend it with more fields that return local-only state.
Type policies are really versatile.

Now in our component, we can query for that piece of state, as if it was part of our GraphQL graph:

```jsx
  const { data, loading } = useQuery(
    gql`
      query {
        bob @client
        quotes {
          text
        }
      }
    `
  );
  if (loading) {
    return <span>Loading...</span>;
  }
  return (
    <div className="container">
      What is Bob doing:
      <span className="bob">{data.bob}</span>
      <span className="quote">{data.quotes[0].text}</span>
    </div>
  );
```

**🎈️ Important:** to stop Apollo from actually querying your server with "bob" (which would throw an error), you need to attach the `@client` directive to your query.

## Reactive variables

We now have a consistent mechanism that all our components can use to query state.

But what if we want to **update** the value of `bob`?

Apollo Client v3 introduced ["Reactive variables"](https://www.apollographql.com/docs/react/local-state/reactive-variables/):

```jsx
import { makeVar } from "@apollo/client";

const bobVar = makeVar("😴");

function readBob() {
  return bobVar();
}

function updateBob(newValue) {
  bobVar(newValue);
}
```

Reactive Variables are not tied to GraphQL. You can use them without any GraphQL at all.
They're just a mechanism to create reactive state:
- you read the state a reactive variable holds by invoking it as a function (passing no values)
- and you update its value by invoking it with a new value

The "reactivity" benefit comes in when you combine it with utilities like the `useReactiveState` hook:

```jsx
const bob = useReactiveVar(bobVar);

return <div>{bob}</div>;
```

Whenever we update `bobVar`, all components that use that variable, will also update.

## Using Reactive variables in your client-side graph

Apollo Client allows us to return reactive variables from type policies:

```jsx
const bobVar = makeVar("😴");

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        bob() {
          return bobVar();
        }
      }
    }
  }
});
```

In our component, we can now create a function that updates the variable:

```jsx
const scareBob = () => bobVar("😱");
```

And call it whenever the user clicks on a button:

```jsx
  const { data } = useQuery(
    gql`
      query {
        bob @client
      }
    `
  );
  return (
    <div className="container">
      <Button onClick={() => scareBob()} variant="outlined">
        <span role="img" aria-label="ghost-emoji">
          👻
        </span>{" "}
        Boo
      </Button>
      <span role="img" aria-label="state-of-bob" className="bob">
        {data.bob}
      </span>
    </div>
  );
```

Now whenever the user clicks the button, we'll update the reactive variable `bobVar`, which will tell Apollo to re-render any components querying for the `bob`
field:

![Scaring bob](./bob_scare.gif)

[See the complete example here](https://codesandbox.io/s/apollo-reactive-variables-8s3h8?file=/src/App.js)

## Coming soon - Reactive Variables and mutations

Our existing setup is nice because components have a consistent mechanism for requesting data in the shape that they want, regardless of whether
that data comes from the server or is client-only.

But if they want to **request changes to that data**, they have to either **create a mutation** (for server data) or **update the reactive
variables** (for client data). So the mechanism for updating data is still inconsistent.

Stay tuned for the next article, where we'll look at how to abstract away the logic of updating your Reactive Variables inside
a **mutation field policy**, after which components will be able to always and consistently make GraphQL mutations 
for updating entities (server or client only).
