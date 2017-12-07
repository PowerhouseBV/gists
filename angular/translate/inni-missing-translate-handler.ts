/**
 * 2017-12-07
 *
 * Gist to show how translations can be lazily loaded.
 * The dictionary (server side) has different namespaces. Every translation key is prefixed by the namespace. For example:
 * - core.firstname
 * - validations.required_field
 * - admin_module.configuration
 *
 * When loading translations, this MissingTranslationHandler will only load the namespace of the missing translation.
 *
 * NB. When switching language be sure to call both TranslateService::setDefaultLang and TranslateService::use, otherwise
 * the MissingTranslationHandler might not be called.
 */

export class InniMissingTranslationHandler extends MissingTranslationHandler {
    /**
     * map for translations administration
     * language --> namespace --> Observable | boolean
     * if for language/namespace combination no value exists then that combination is not yet loaded.
     * if a language/namespace combination yields a Observable, then that combination is being loaded.
     * if a language/namespace combination yields a boolean value (true) then that combination is loaded.
     */
    namespacesLoaded: { [language: string]: { [namespace: string]: Observable<any> | boolean}; } = {};

    constructor(private restEndpointService: RestEndpointService, private translateParser: TranslateParser ) {
        super();
    }

    handle(params: MissingTranslationHandlerParams): any {
        const namespace = params.key.split('.')[0];
        const key = params.key.split('.').slice(1).join('.');
        const currentLang = params.translateService.currentLang;

        if (!this.namespacesLoaded[currentLang]) {
            this.namespacesLoaded[currentLang] = {};
        }

        const status = this.namespacesLoaded[currentLang][namespace];
        if (typeof status === 'undefined') {
            // load translations for language/namespace combination
            // when done set namespacesLoaded[currentLang][namespace] to true
            const translateLoader = new InniRestTranslateLoader(this.restEndpointService, namespace);
            const $translations = translateLoader.getTranslation(currentLang)
                .do(translations => params.translateService.setTranslation(currentLang, translations, true))
                .do(() => this.namespacesLoaded[currentLang][namespace] = true)
                .publishReplay()
                .refCount();

            // translations are being loaded, put observable in namespacesLoaded[currentLang][namespace]
            this.namespacesLoaded[currentLang][namespace] = $translations;

            // return observable for requested translation
            return $translations.map(translations => this.translateParser
                .interpolate(translations[namespace][key], params.interpolateParams))
                .map(translation => translation === undefined ? params.key : translation);
        } else {

            if (typeof status !== 'boolean') {
                // translations are being loaded, return observable for requested translation
                return status.map(translations => this.translateParser
                    .interpolate(translations[namespace][key], params.interpolateParams))
                    .map(translation => translation === undefined ? params.key : translation);
            }
        }
    }
}
