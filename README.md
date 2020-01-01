# Slambda

**Slambda** is a TypeScript library for authoring event handlers for AWS Lambda proxy events and Netlify Functions.

## Install
```
yarn add https://github.com/jaredkrinke/modules.git#slambda-0.1.0
```

## Example

### Import

```typescript
import * as Slambda from "slambda";
```

### Input validation
To use Slambda, you declare interfaces for your request and response formats, e.g.:

```typescript
interface TopScoresRequest {
    mode: number;
}

interface TopScore {
    initials: string;
    score: number;
}

type TopScoresResponse = TopScore[];
```

Additionally, you write functions (that throw on error) to validate that the request's JSON is valid and matches your request interface:

```typescript
const validateTopScoresRequest = Slambda.createValidator<TopScoresRequest>({
    mode: Slambda.createNumberValidator(1, 3),
});
```

### Handler
The handler (which should be exported) is created with `Slambda.createHandler` along with various options. The main options are:

* `method`: Expected HTTP request method (e.g. "GET")
* `parse`: Function for retrieving the request object
  * Use `Slambda.parseBodyText` (the default) to parse stringified JSON from the request body
  * Use `Slambda.parseQueryString` to parse the object out the the query string parameters
* `validate`: Function to validate the parsed JSON object (this should throw on error)
* `createHeaders`: Optional for attaching headers to the response (e.g. `Slambda.createCorsWildcardHeaders` to support cross-origin calls from any domain)
* `handle`: Asynchronous handler for business logic

```typescript
export const handler = Slambda.createHandler<TopScoresRequest, TopScoresResponse>({
    method: "GET",
    parse: Slambda.parseQueryString,
    validate: validateTopScoresRequest,
    createHeaders: Slambda.createCorsWildcardHeaders,

    handle: async (request) => {
        const records = await root
            .where("mode", "==", request.mode)
            .select("initials", "score")
            .orderBy("score", "desc")
            .limit(10)
            .get();

        let response: TopScoresResponse = [];
        records.forEach(doc => response.push(doc.data() as TopScore));

        return response;
    },
});
```
