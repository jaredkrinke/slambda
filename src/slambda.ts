import * as AwsLambda from "aws-lambda";

// Useful definitions
const trace = (process.env.SLAMBDA_TRACE === "1");

const statusCode = {
    ok: 200,
    badRequest: 400,
    internalServerError: 500,
};

// Validation helpers
export function createStringValidator(pattern: RegExp): (x: any) => string {
    return function (x) {
        if (typeof(x) === "string" && pattern.test(x)) {
            return x;
        } else {
            throw new Error("Invalid string");
        }
    };
}

export function createNumberValidator(min: number, max: number): (x: any) => number {
    return function (x) {
        let number = undefined;
        if (typeof(x) === "number") {
            number = x;
        } else if (typeof(x) === "string") {
            number = parseInt(x);
        }
    
        if (number !== undefined && !isNaN(number) && number >= min && number <= max) {
            return number;
        } else {
            throw new Error("Invalid number");
        }
    }
}

export type ValidatorMap<T> = {
    [P in keyof T]: (input: any) => T[P];
};

export function createValidator<T>(validator: ValidatorMap<T>): (input: object) => T {
    return function (input: object): T {
        let result = {};
        for (let key in input) {
            if (typeof(key) !== "string") {
                throw new Error("Invalid field");
            }
    
            const fieldName = key as string;
            const fieldValidator = validator[fieldName];
            if (!fieldValidator) {
                throw new Error("Extraneous field");
            }
    
            result[fieldName] = fieldValidator(input[fieldName]);
        }

        for (let key in validator) {
            if (typeof(key) === "string") {
                const fieldName = key as string;
                if (input[fieldName] === undefined || input[fieldName] === null) {
                    throw new Error("Missing field");
                }
            }
        }

        return result as T;
    };
}

// Handler helpers
type Method = "GET" | "PUT" | "POST" | "DELETE";

export function parseTextBody(request: AwsLambda.APIGatewayProxyEvent): object {
    return JSON.parse(request.body);
}

export function parseQueryString(request: AwsLambda.APIGatewayProxyEvent): object {
    return request.queryStringParameters;
}

export type Headers = {
    [header: string]: boolean | number | string;
};

export function createEmptyHeaders(): undefined {
    return undefined;
}

export function createCorsWildcardHeaders(): Headers {
    return {
        "Access-Control-Allow-Origin": "*",
    };
}

export interface CreateHandlerOptions<TRequest, TResponse> {
    method?: Method;
    validate: (input: object) => TRequest;
    handle: (record: TRequest) => Promise<TResponse>;
    parse?: (request: AwsLambda.APIGatewayProxyEvent) => object;
    createHeaders?: () => Headers | undefined;
}

export function createHandler<TRequest, TResponse>(options: CreateHandlerOptions<TRequest, TResponse>): AwsLambda.APIGatewayProxyHandler {
    const { validate, handle } = options;
    const method = options.method || "GET";
    const parse = options.parse || parseTextBody;
    const createHeaders = options.createHeaders || createEmptyHeaders;

    return async (event) => {
        try {
            if (event.httpMethod !== method) {
                throw new Error("Incorrect method");
            }

            const request = validate(parse(event));
            try {
                const response = await handle(request);
                return {
                    statusCode: statusCode.ok,
                    headers: createHeaders(),
                    body: JSON.stringify(response),
                };
            } catch (err) {
                if (trace) {
                    console.error(err);
                }
                return { statusCode: statusCode.internalServerError, body: "" };
            }
        } catch (err) {
            if (trace) {
                console.error(err);
            }
            return { statusCode: statusCode.badRequest, body: "" }
        }
    }
}
