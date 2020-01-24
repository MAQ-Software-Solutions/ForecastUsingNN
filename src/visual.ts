/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
module powerbi.extensibility.visual {
    'use strict';

    // in order to improve the performance, one can update the <head> only in the initial rendering.
    // set to 'true' if you are using different packages to create the widgets

    export interface ISettings {
        parameterSettings: string;
        units: number;
        decay: number;
        maxitr: number;
        epochs: number;
        size: number;
        confLevel: number;
        confInterval: boolean;
    }

    export interface IPlotSettings {
        plotColor: string;
        fline: string;
        hline: string;
        flineText: string;
        hlineText: string;
        confText: string;
        confCol: string;
    }

    export interface IXaxisSettings {
        xTitle: string;
        xZeroline: boolean;
        xLabels: boolean;
        xGrid: boolean;
        xGridCol: string;
        xGridWidth: number;
        xAxisBaseLine: boolean;
        xAxisBaseLineCol: string;
        xAxisBaseLineWidth: number;
    }

    export interface IYaxisSettings {
        yTitle: string;
        yZeroline: boolean;
        yLabels: boolean;
        yGrid: boolean;
        yGridCol: string;
        yGridWidth: number;
        yAxisBaseLine: boolean;
        yAxisBaseLineCol: string;
        yAxisBaseLineWidth: number;
    }
    const updateHTMLHead: boolean = false;
    const renderVisualUpdateType: number[] = [
        VisualUpdateType.Resize,
        VisualUpdateType.ResizeEnd,
        VisualUpdateType.Resize + VisualUpdateType.ResizeEnd
    ];

    export class ForecastingUsingNN implements IVisual {
        private rootElement: HTMLElement;
        private headNodes: Node[];
        private bodyNodes: Node[];

        public plotSettings: IPlotSettings;
        public xaxisSettings: IXaxisSettings;
        public yaxisSettings: IYaxisSettings;
        public isettings: ISettings;

        public constructor(options: VisualConstructorOptions) {
            if (options && options.element) {
                this.rootElement = options.element;
            }
            this.headNodes = [];
            this.bodyNodes = [];
        }

        public update(options: VisualUpdateOptions): void {
            if (!options ||
                !options.type ||
                !options.viewport ||
                !options.dataViews ||
                options.dataViews.length === 0 ||
                !options.dataViews[0]) {
                return;
            }
            const dataView: DataView = options.dataViews[0];
            this.updateObjects(dataView.metadata.objects);

            let payloadBase64: string = null;
            if (dataView.scriptResult && dataView.scriptResult.payloadBase64) {
                payloadBase64 = dataView.scriptResult.payloadBase64;
            }

            if (renderVisualUpdateType.indexOf(options.type) === -1) {
                if (payloadBase64) {
                    this.injectCodeFromPayload(payloadBase64);
                }
            } else {
                this.onResizing(options.viewport);
            }
        }

        public onResizing(finalViewport: IViewport): void {
            /* add code to handle resizing of the view port */
        }

        private injectCodeFromPayload(payloadBase64: string): void {
            // inject HTML from payload, created in R
            // the code is injected to the 'head' and 'body' sections.
            // if the visual was already rendered, the previous DOM elements are cleared

            ResetInjector();

            if (!payloadBase64) {
                return;
            }

            // create 'virtual' HTML, so parsing is easier
            const el: HTMLHtmlElement = document.createElement('html');
            try {
                el.innerHTML = window.atob(payloadBase64);
            } catch (err) {
                return;
            }

            // if 'updateHTMLHead == false', then the code updates the header data only on the 1st rendering
            // this option allows loading and parsing of large and recurring scripts only once.
            if (updateHTMLHead || this.headNodes.length === 0) {
                while (this.headNodes.length > 0) {
                    const tempNode: Node = this.headNodes.pop();
                    document.head.removeChild(tempNode);
                }
                const headList: NodeListOf<HTMLHeadElement> = el.getElementsByTagName('head');
                if (headList && headList.length > 0) {
                    const head: HTMLHeadElement = headList[0];
                    this.headNodes = ParseElement(head, document.head);
                }
            }

            // update 'body' nodes, under the rootElement
            while (this.bodyNodes.length > 0) {
                const tempNode: Node = this.bodyNodes.pop();
                this.rootElement.removeChild(tempNode);
            }
            const bodyList: NodeListOf<HTMLBodyElement> = el.getElementsByTagName('body');
            if (bodyList && bodyList.length > 0) {
                const body: HTMLBodyElement = bodyList[0];
                this.bodyNodes = ParseElement(body, this.rootElement);
            }

            RunHTMLWidgetRenderer();
        }

        public updateObjects(objects: DataViewObjects): void {
            let units: number = getValue<number>(objects, 'settings', 'units', 10);
            units = units <= 0 ? 10 : getValue<number>(objects, 'settings', 'units', 10);
            const decay: number = parseFloat(getValue<string>(objects, 'settings', 'decay', '0.009'));
            const maxitr: number = parseFloat(getValue<string>(objects, 'settings', 'maxitr', '200'));
            const epochs: number = parseFloat(getValue<string>(objects, 'settings', 'epochs', '8'));
            const size : number = parseFloat(getValue<string>(objects, 'settings', 'size', '20'));
            const confLevel : number = parseFloat(getValue<string>(objects, 'settings', 'confLevel', '0.8'));

            let xGridWidth: number = getValue<number>(objects, 'xaxisSettings', 'xGridWidth', 0.1);
            xGridWidth = xGridWidth < 0.1 ? 0.1 : xGridWidth > 5 ? 0.1 : getValue<number>(objects, 'xaxisSettings', 'xGridWidth', 0.1);
            let xAxisBaseLineWidth: number = getValue<number>(objects, 'xaxisSettings', 'xAxisBaseLineWidth', 4);
            xAxisBaseLineWidth = xAxisBaseLineWidth < 1 ? 4 :
            xAxisBaseLineWidth > 11 ? 4 : getValue<number>(objects, 'xaxisSettings', 'xAxisBaseLineWidth', 4);

            let yGridWidth: number = getValue<number>(objects, 'yaxisSettings', 'yGridWidth', 0.1);
            yGridWidth = yGridWidth < 0.1 ? 0.1 : yGridWidth > 5 ? 0.1 : getValue<number>(objects, 'yaxisSettings', 'yGridWidth', 0.1);
            let yAxisBaseLineWidth: number = getValue<number>(objects, 'yaxisSettings', 'yAxisBaseLineWidth', 4);
            yAxisBaseLineWidth = yAxisBaseLineWidth < 1 ? 4 :
            yAxisBaseLineWidth > 11 ? 4 : getValue<number>(objects, 'yaxisSettings', 'yAxisBaseLineWidth', 4);

            this.isettings = {
                parameterSettings: getValue<string>(objects, 'settings', 'parameterSettings', 'Auto'),
                units: units,
                decay: decay,
                maxitr: maxitr,
                epochs: epochs,
                size: size,
                confLevel: confLevel,
                confInterval: getValue<boolean>(objects, 'settings', 'confInterval', false)
            };

            this.plotSettings = {
                plotColor: getValue<string>(objects, 'plotSettings', 'plotColor', '#FFFFFF'),
                fline: getValue<string>(objects, 'plotSettings', 'fline', '#F2C80F'),
                hline: getValue<string>(objects, 'plotSettings', 'hline', '#01B8AA'),
                flineText: getValue<string>(objects, 'plotSettings', 'flineText', 'Prediction'),
                hlineText: getValue<string>(objects, 'plotSettings', 'hlineText', 'Observed'),
                confCol: getValue<string>(objects, 'plotSettings', 'confCol', 'Gray95'),
                confText: getValue<string>(objects, 'plotSettings', 'confText', 'Confidence')
            };
            this.xaxisSettings = {
                xTitle: getValue<string>(objects, 'xaxisSettings', 'xTitle', ''),
                xZeroline: getValue<boolean>(objects, 'xaxisSettings', 'xZeroline', true),
                xLabels: getValue<boolean>(objects, 'xaxisSettings', 'xLabels', true),
                xGrid: getValue<boolean>(objects, 'xaxisSettings', 'xGrid', true),
                xGridCol: getValue<string>(objects, 'xaxisSettings', 'xGridCol', '#BFC4C5'),
                xGridWidth: xGridWidth,
                xAxisBaseLine: getValue<boolean>(objects, 'xaxisSettings', 'xAxisBaseLine', true),
                xAxisBaseLineCol: getValue<string>(objects, 'xaxisSettings', 'xAxisBaseLineCol', '#000000'),
                xAxisBaseLineWidth: xAxisBaseLineWidth
            };

            this.yaxisSettings = {
                yTitle: getValue<string>(objects, 'yaxisSettings', 'yTitle', ''),
                yZeroline: getValue<boolean>(objects, 'yaxisSettings', 'yZeroline', true),
                yLabels: getValue<boolean>(objects, 'yaxisSettings', 'yLabels', true),
                yGrid: getValue<boolean>(objects, 'yaxisSettings', 'yGrid', true),
                yGridCol: getValue<string>(objects, 'yaxisSettings', 'yGridCol', '#BFC4C5'),
                yGridWidth: yGridWidth,
                yAxisBaseLine: getValue<boolean>(objects, 'yaxisSettings', 'yAxisBaseLine', true),
                yAxisBaseLineCol: getValue<string>(objects, 'yaxisSettings', 'yAxisBaseLineCol', '#000000'),
                yAxisBaseLineWidth: yAxisBaseLineWidth
            };
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions):
            VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            let objectName: string;
            objectName = options.objectName;
            let objectEnum: VisualObjectInstance[];
            objectEnum = [];
            let props: { [propertyName: string]: DataViewPropertyValue; };
            switch (objectName) {
                case 'settings':
                    props = {};
                    props[`parameterSettings`] = this.isettings.parameterSettings;
                    if (this.isettings.parameterSettings === 'Auto') {
                        props[`units`] = this.isettings.units;
                    } else {
                        props[`decay`] = this.isettings.decay;
                        props[`maxitr`] = this.isettings.maxitr;
                        props[`units`] = this.isettings.units;
                        props[`epochs`] = this.isettings.epochs;
                        props[`size`] = this.isettings.size;
                    }
                    props[`confInterval`] = this.isettings.confInterval;
                    if (this.isettings.confInterval) {
                        props[`confLevel`] = this.isettings.confLevel;
                    }
                    objectEnum.push({
                        objectName: objectName,
                        properties: props,
                        selector: null
                    });
                    break;

                case 'plotSettings':
                    objectEnum.push({
                        objectName: objectName,
                        properties: {
                            plotColor: this.plotSettings.plotColor,
                            fline: this.plotSettings.fline,
                            hline: this.plotSettings.hline,
                            flineText: this.plotSettings.flineText,
                            hlineText: this.plotSettings.hlineText,
                            confCol: this.plotSettings.confCol,
                            confText: this.plotSettings.confText

                        },
                        selector: null
                    });
                    break;

                case 'xaxisSettings':
                    props = {};
                    props[`xTitle`] = this.xaxisSettings.xTitle;
                    props[`xZeroline`] = this.xaxisSettings.xZeroline;
                    props[`xLabels`] = this.xaxisSettings.xLabels;
                    props[`xGrid`] = this.xaxisSettings.xGrid;
                    if (this.xaxisSettings.xGrid) {
                        props[`xGridCol`] = this.xaxisSettings.xGridCol;
                        props[`xGridWidth`] = this.xaxisSettings.xGridWidth;
                    }
                    props[`xAxisBaseLine`] = this.xaxisSettings.xAxisBaseLine;
                    if (this.xaxisSettings.xAxisBaseLine) {
                        props[`xAxisBaseLineCol`] = this.xaxisSettings.xAxisBaseLineCol;
                        props[`xAxisBaseLineWidth`] = this.xaxisSettings.xAxisBaseLineWidth;
                    }
                    objectEnum.push({
                        objectName: objectName,
                        properties: props,
                        selector: null
                    });
                    break;

                case 'yaxisSettings':
                    props = {};
                    props[`yTitle`] = this.yaxisSettings.yTitle;
                    props[`yZeroline`] = this.yaxisSettings.yZeroline;
                    props[`yLabels`] = this.yaxisSettings.yLabels;
                    props[`yGrid`] = this.yaxisSettings.yGrid;
                    if (this.yaxisSettings.yGrid) {
                        props[`yGridCol`] = this.yaxisSettings.yGridCol;
                        props[`yGridWidth`] = this.yaxisSettings.yGridWidth;
                    }
                    props[`yAxisBaseLine`] = this.yaxisSettings.yAxisBaseLine;
                    if (this.yaxisSettings.yAxisBaseLine) {
                        props[`yAxisBaseLineCol`] = this.yaxisSettings.yAxisBaseLineCol;
                        props[`yAxisBaseLineWidth`] = this.yaxisSettings.yAxisBaseLineWidth;
                    }
                    objectEnum.push({
                        objectName: objectName,
                        properties: props,
                        selector: null
                    });
                    break;

                default:
                    break;
            }

            return objectEnum;
        }
    }
}
