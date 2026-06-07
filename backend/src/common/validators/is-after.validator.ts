import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsAfter(siblingField: string, validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isAfter',
            target: (object as any).constructor,
            propertyName,
            constraints: [siblingField],
            options: validationOptions,
            validator: {
                validate(value: unknown, args: ValidationArguments) {
                    const [sibling] = args.constraints as string[];
                    const siblingValue = (args.object as Record<string, unknown>)[sibling];
                    if (!value || !siblingValue) return true;
                    return new Date(value as string) > new Date(siblingValue as string);
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be after ${args.constraints[0] as string}`;
                },
            },
        });
    };
}
