import React, { Component } from 'react'
import { Loading } from 'carbon-components-react';
// import { loadJSONData } from "../helperfunctions/HelperFunctions"
import "./viz.css"
import LineChart from "../linechart/LineChart"
import SmallLineChart from "../linechart/SmallLineChart"
import DrawSignal from "../drawsignal/DrawSignal"
import ComposeModel from "../composemodel/ComposeModel"
// import "../../data" 
import * as tf from '@tensorflow/tfjs';

// let tf = null
class Viz extends Component {
    constructor(props) {
        super(props)

        this.modelChartWidth = Math.min(390, window.innerWidth - 25)
        this.modelChartHeight = 280

        // Allow the draw signal component update current signal with drawn signal
        this.updateCurrentSignal = this.updateCurrentSignal.bind(this)



        this.testData = require("../../data/ecg/test.json")
        this.testData = this.testData.slice(0, 70)

        this.zeroArr = new Array(this.testData[0].data.length).fill(0);


        this.state = {
            apptitle: "Anomagram",
            trainData: [],
            selectedIndex: 0,
            selectedData: this.testData[0].data,
            showDrawData: false,
            drawSectionWidth: 350,
            drawSectionHeight: this.modelChartHeight - 30,
            isLoading: false,
            modelLoaded: false,
            threshold: 0.011,
            predictedData: this.zeroArr,
            predictedMse: null,
            selectedLegend: "All",
            showAutoEncoderViz: true
        }


        // this.trainData = require("../../data/ecg/train.json")
        // console.log(this.testData.length, this.trainData.length)

        this.loadData()

        this.chartColorMap = {
            0: { color: "grey", colornorm: "grey", name: "All" },
            1: { color: "#0062ff", colornorm: "#0062ff", name: "Normal" },
            2: { color: "#ffa32c", colornorm: "grey", name: "R-on-T Premature Ventricular Contraction" },
            // 3: { color: "violet", colornorm: "grey", name: "Supraventricular Premature or Ectopic Beat" },
            4: { color: "orange", colornorm: "grey", name: "Premature Ventricular Contraction" },
            5: { color: "red", colornorm: "grey", name: "Unclassifiable Beat" },
        }

        this.maxSmallChart = 100
        this.modelDataLastUpdated = true


        this.hiddenDim = [7, 3]
        this.latentDim = [2]

    }


    loadData() {
        // let testECGDataPath = process.env.PUBLIC_URL + "/data/ecg/test_small.json"
        // let trainECGDataPath = process.env.PUBLIC_URL + "/data/ecg/train_small.json"
        // loadJSONData(testECGDataPath).then(data => {
        //     this.setState({ testData: data })
        //     // console.log("test data loaded", data.length)
        // })

        // loadJSONData(trainECGDataPath).then(data => {
        //     this.setState({ trainData: data })
        // })

    }
    componentDidUpdate(prevProps, prevState) {


    }


    componentDidMount() {
        this.apptitle = "Amadioha"

        // window.addEventListener("resize", this.onWindowResize.bind(this))
        // console.log(this.refs["datasection"].offsetWidth)
        this.setState({ drawSectionWidth: this.refs["datasection"].offsetWidth - 5 })
        this.drawSectionWidth = this.refs["datasection"].offsetWidth

        // console.log(tf.memory());
        // setTimeout(() => {
        //     this.setState({ showAutoEncoderViz: true })
        // }, 2000);
    }

    componentWillUnmount() {
        // window.removeEventListener("resize", this.onWindowResize)
        if (this.loadedModel) {
            this.loadedModel.dispose()
        }
    }

    applyTransform(data) {
        let holder = []
        for (let i = 0; i < data.length; i++) {
            holder[i] = ((data[i] - this.xMinArray[i]) / (this.xMaxArray[i] - this.xMinArray[i])) * (this.featureRange["max"] - this.featureRange["min"]) + this.featureRange["min"]
        }
        return holder
    }

    applyReverseTransform(data) {
        let holder = []
        // df = ((df - xmin) / (xmax - xmin)) * (max_val - min_val) + min_val
        // real_output = data * (b - a) + a
        for (let i = 0; i < data.length; i++) {
            holder[i] = ((data[i] - this.featureRange["min"]) / (this.featureRange["max"] - this.featureRange["min"])) * (this.xMaxArray[i] - this.xMinArray[i]) + this.xMinArray[i]
        }
        return holder
    }




    loadModel() {
        this.setState({ isLoading: true })


        this.xMinArray = require("../../data/ecg/transform/xmin.json")
        this.xMaxArray = require("../../data/ecg/transform/xmax.json")
        this.featureRange = require("../../data/ecg/transform/range.json")

        setTimeout(() => {
            let modelPath = "/webmodel/ecg/model.json"
            tf.loadLayersModel(modelPath).then((model) => {
                this.loadedModel = model
                this.setState({ modelLoaded: true, isLoading: false })
                this.getPrediction(this.state.selectedData)
            });
        }, 700);
    }

    // Get predictions for a selected datapoint
    getPrediction(data) {

        if (!this.state.modelLoaded) {
            this.setState({ selectedData: data })
            this.loadModel()
        } else {
            this.setState({ isLoading: true })

            let transformedData = this.applyTransform(data)
            // let revTrans = this.applyReverseTransform(transformedData)
            // console.log(data.slice(0, 5), revTrans.slice(0, 5));


            // Get predictions  
            const [mse, preds] = tf.tidy(() => {
                let dataTensor = tf.tensor2d(transformedData, [1, 140])
                let preds = this.loadedModel.predict(dataTensor, { batchSize: 8 })
                return [tf.sub(preds, dataTensor).square().mean(1), preds]
            })

            mse.array().then(array => {
                // console.log(array);
                this.setState({ isLoading: false, predictedMse: array[0] })
            });

            preds.array().then(array => {
                this.modelDataLastUpdated = !this.modelDataLastUpdated
                this.setState({ selectedData: data, predictedData: this.applyReverseTransform(array[0]) }, () => {

                })
            });

            mse.dispose()
            preds.dispose()
        }



    }



    updateCurrentSignal(data) {
        this.getPrediction(data)
    }


    clickDataPoint(e) {

        let selectedData = this.testData[e.target.getAttribute("indexvalue")].data
        // set data and get predictions on click 
        this.setSelectedData(e.target.getAttribute("indexvalue"), selectedData)

    }

    setSelectedData(index, data) {

        this.setState({ selectedIndex: index }, () => {
            this.getPrediction(data)
        })
    }

    onWindowResize() {
        console.log(this.refs["datasection"].offsetWidth);

        this.setState({ drawSectionWidth: this.refs["datasection"].offsetWidth - 5 })
    }


    toggleDataOptions(e) {
        this.setState({ showDrawData: e })

    }
    setDatasetDraw(e) {
        this.setState({ showDrawData: true })
        // this.setState({ drawSectionWidth: this.refs["datasection"].offsetWidth })
        // console.log(this.refs["datasection"].offsetWidth);

    }
    setDatasetECG(e) {
        this.setState({ showDrawData: false })

        this.setSelectedData(0, this.testData[0].data)

    }

    clickLegend(e) {
        // console.log(e.target);
        // this.state.selectedLegend = e.target.getAttribute("action")
        this.setState({ selectedLegend: e.target.getAttribute("action") })
    }

    render() {


        let dataLegend = Object.entries(this.chartColorMap).map((data, index) => {
            let color = data[1].color
            let name = data[1].name
            // console.log(name); 
            return (
                <div action={name} onClick={this.clickLegend.bind(this)} className={"iblock mr5 mb5 legendrow clickable" + (this.state.selectedLegend === name ? " active" : " ")} key={"legendrow" + index}>
                    <div style={{ background: color }} className="unclickable indicatorcircle iblock mr5"></div>
                    <div className="iblock unclickable legendtext pl4 mediumdesc"> {name}</div>


                </div>
            )
        });

        let dataPoints = this.testData.slice(0, this.maxSmallChart).map((data, index) => {
            // console.log(this.testData[index].target);
            if (this.testData[index].target + "" !== "3") {
                let isVisible = (this.state.selectedLegend === this.chartColorMap[this.testData[index].target].name) || this.state.selectedLegend === "All"

                console.log();

                return (
                    <div onClick={this.clickDataPoint.bind(this)} key={"testrow" + index} className={"mb5 p5 clickable  ecgdatapoint rad3 iblock mr5" + (isVisible ? " " : " displaynone ") + (this.state.selectedIndex + "" === index + "" ? " active " : "")} indexvalue={index} targetval={data.target} >
                        <div indexvalue={index} className="boldtext  unclickable iblock ">
                            <div className="positionrelative">
                                <div className="p3 indicatoroutrcircle  positionabsolute bottomright">
                                    <div style={{ background: this.chartColorMap[this.testData[index].target].color }} className="indicatorcircle "></div>
                                </div>
                                <SmallLineChart
                                    data={{
                                        data: this.testData[index],
                                        index: index,
                                        color: this.chartColorMap[this.testData[index].target].colornorm,
                                        chartWidth: 72,
                                        chartHeight: 30
                                    }}
                                > </SmallLineChart>
                            </div>

                        </div>

                    </div>
                )
            }
        });

        let datasetExamples = (
            <div className="flex">
                <div className="flex20 mr10">
                    <div className="mb5">
                        {dataLegend}
                    </div>
                    <div className="ecgdatabox scrollwindow">
                        {dataPoints}
                    </div>
                </div>
                <div className="p10 greyhighlight displaynone">
                    Threshold ring implementation
                </div>
            </div>
        )

        let dataSketchPad = (
            <div >
                <DrawSignal
                    width={this.state.drawSectionWidth}
                    height={this.state.drawSectionHeight}
                    updateCurrentSignal={this.updateCurrentSignal}
                ></DrawSignal>
            </div>
        )
        let barColor = this.state.predictedMse ? this.state.predictedMse > this.state.threshold ? "#ff0000" : "#008000" : "#808080"
        let modelOutput = (
            <div className="  modeloutputbox rad5 ">
                {/* <div className="mb10 boldtext"> Model Prediction</div> */}
                <div className="flex  ">
                    <div className="iblock ">
                        <div ref="" className="resetbox vizloadingbox" style={{ opacity: (this.state.isLoading) ? 1 : 0, width: (this.state.isLoading) ? "34px" : "0px" }} >
                            <Loading
                                className=" mr10"
                                active={true}
                                small={true}
                                withOverlay={false}
                            > </Loading>
                        </div>
                    </div>
                    <div className="flexfull ">
                        {this.testData.length > 0 &&
                            <div className="mt5 mediumdesc mb5">
                                {this.state.predictedMse &&
                                    <div className="mr10  ">
                                        <div className="mr10 boldtext ">
                                        MODEL PREDICTION [<span className=""> MSE = </span>  {this.state.predictedMse.toFixed(3)}]:
                                        
                                        &nbsp;
                                        {this.state.predictedMse > this.state.threshold ? "ABNORMAL" : "NORMAL"}
                                            </div>

                                        <div className="pt5 mediumdesc"> <strong>Explanation</strong>: <strong> mse = {this.state.predictedMse.toFixed(3)}</strong> is 
                                        <strong>{this.state.predictedMse > this.state.threshold ? " above " : " below"}</strong> the threshold <strong> {this.state.threshold}</strong>
                                    </div>
                                    </div>
                                }
                                {!this.state.predictedMse &&
                                <div className="mr10  ">
                                        <div className=" boldtext ">
                                        MODEL PREDICTION 
                                        </div>
                                      
                                        <div className="pt5 mediumdesc">
                                        Select a signal or draw one!
                                        </div>
                                    </div>
                            }
                                <div style={{ backgroundColor: barColor }} ref="predictioncolordiv" className="mt5 colorbox redbox"></div>
                            

                            </div>
                        }
                    </div>
                </div>
                <div className="iblock ">
                    <LineChart
                        data={this.state.selectedData}
                        predictedData={this.state.predictedData}
                        predictedColor={barColor}
                        index={this.state.selectedIndex}
                        lastUpdated={this.modelDataLastUpdated}
                        color={this.chartColorMap[this.testData[this.state.selectedIndex].target].colornorm}
                        width={this.modelChartWidth}
                        height={this.modelChartHeight}
                    > </LineChart>
                </div>
            </div>
        )

        // if (this.refs["datasetexamplebox"]) {
        //     console.log(this.refs["datasetexamplebox"].offsetWidth);
        // } 

        return (
            <div>
                {/* <div className="bold mt10 sectiontitle mb10">
                    A Gentle Introduction to Anomaly Detection with Deep Learning (in the Browser!)
                </div> */}

                <div className="mynotif mt10 h100 lh10  lightbluehightlight maxh16  mb10">
                    <div className="boldtext mb5">  A Gentle Introduction to Anomaly Detection with Autoencoders (in the Browser!)</div>
                    {this.state.apptitle} is an interactive visualization tool for exploring
                    deep learning models applied to the task of anomaly detection (on stationary data).
                    Given an ECG signal sample, an autoencoder model (running live in your browser) can predict if this signals
                    is normal or abnormal. To try it out, you can select any of the test ECG signals from the ECG5000 dataset below,
                    or better still, you can draw a signal to see the model's prediction!
                    <div className=" mediumdesc boldtext">
                        <span className=""> Disclaimer: </span> This prototype is built to demonstrate autoencoders
                        and is not intended for use in any medical setting.
                    </div>
                </div>


                <div className="mediumdesc pb5 "> Select  Data source</div>

                <div className="mb10 lowerbar">
                    <div onClick={this.setDatasetECG.bind(this)} className={"datasettab clickable iblock mr5 " + (this.state.showDrawData ? "" : " active")}> ECG5000 Dataset</div>
                    <div onClick={this.setDatasetDraw.bind(this)} className={"datasettab clickable iblock mr10 " + (this.state.showDrawData ? " active" : " ")}> Draw your ECG data</div>


                </div>

                <div className="flex flexwrap ">

                    <div ref="datasection" className=" flexwrapitem  flex20 mr10 " >
                        {<div ref="datasetexamplebox" className={" " + (this.state.showDrawData ? " displaynone" : " ")}>
                            {datasetExamples}
                        </div>}
                        {<div className={" " + (!this.state.showDrawData ? " displaynone" : " ")}>
                            {dataSketchPad}
                        </div>}
                    </div>

                    {/* <div style={{width: "200px"}} className="flexwrapitem h100 p10 border">
                             Threshold gauge etc
                     </div>
                    */}
                    <div className="flexwrapitem ">
                        {modelOutput}
                    </div>
                </div>

                <div className="lh10 lightgreyback mt5 p10">
                    {/* <div className="boldtext mb5"> .. detecting abnormal ecg signals </div> */}
                    In the use case above, the task is to detect abnormal ECG signals, given an ECG sample which corresponds to a heart beat.
                    This task is valuable because abnormal ECG readings are frequently indicative of underlying medical conditions.
                    Each time, a signal is selected or drawn <div className="legendcolorbox  themeblue colortransition5s iblock"></div>, it is processed by an
                    autoencoder which outputs a reconstruction <div style={{ backgroundColor: barColor }} className="legendcolorbox colortransition5s iblock"></div>) of the signal.
                    The reconstruction error (mean squared error <strong>mse</strong> <div style={{ backgroundColor: barColor + "63" }} className="legendcolorbox colortransition5s iblock"></div> between the input and reconstructed output is also visualized.
                Based on a threshold which we set ( <span className="boldtext">{this.state.threshold}</span>  ), we then flag the signal as  abnormal if the reconstruction error is greater than the threshold.
                </div>



                {
                    <div className=" ">

                        <div className="">
                            <div className="flex">
                                <div className="flex20 lh10 mb10 pr10">
                                    {this.state.showAutoEncoderViz && <div className="floatright autoencodervizbox  p10 flex6"  >

                                        <ComposeModel
                                            hiddenDims={this.hiddenDim}
                                            latentDim={[this.latentDim]}
                                            isTraining={false}
                                            isUpdatable={false}
                                            updateModelDims={null}
                                            adv={"track"}
                                        />

                                        <div className="smalldesc lhmedium p5 "> Example of a two layer autoencoder. Click the train model tab to train one from scratch.</div>
                                    </div>}


                                    <div className="sectiontitle mt10 mb5"> How does the Autoencoder work? </div>

                                    An <a href="https://en.wikipedia.org/wiki/Autoencoder" target="_blank" rel="noopener noreferrer">Autoencoder</a> is a type of
                                    artificial neural network used to learn efficient (low dimensional) data representations in an unsupervised manner.
                                    It is typically comprised of two components
                                    - an <strong>encoder</strong> that learns to map input data to a the low dimension representation ( <strong>z</strong> )
                                    and a <strong>decoder</strong> that learns to reconstruct the original signal from the
                                    low dimension representation.
                                    The training objective for the autoencoder model is to minimize the difference the reconstruction
                                    error - the difference between the input data and the reconstructed output.
                                    While autoencoder models have been widely applied for dimensionality reduction, they can also be used for anomaly detection.
                                    If we train the model on normal data (or data with very few abnormal samples), it learns a reconstruction function that works well for normal looking data (low reconstruction error)
                                    and works poorly for abnormal data (high reconstruction error).
                                    We can then use reconstruction error as a signal for anomaly detection.
                                    <br />
                                    In particular, if we visualize a histrogram of mse errors generated by a trained autoencoder we hopefully
                                    will observe that the distribution of errors for normal samples is overall smaller and
                                    markedly separate from errors for abnormal data.
                                    Click the <a href="/#/train" target="_blank" rel="noopener noreferrer"> Train a Model </a> tab to
                                    interactively build an autoencoder, train and evaluate its performance and visualize the histogram of errors for normal and abnormal test data.

                                    <br />
                                    Note: We may not always have labelled data, but we can can assume (given the rare nature of anomalies) that the majority of data points for most
                                    anomaly detection use cases are normal.
                                </div>


                            </div>

                        </div>


                        <div className="sectiontitle mt10 mb5"> Modeling Normal Data  </div>
                        <div className="">
                            <div className="flex lh10 flexwrap">
                                <div className="flex20 flexwrapitem  mb10 pr10">
                                    <div className="pb5 boldtext"> Data Transformation  </div>
                                    The range of output values from the autoencoder is dependent on the type of activation function used in the final dense layer.
                                    For example, the tanh activation function outputs values in the range of -1 and 1. The autoencoder is tasked with reconstructing the input data.
                                    To achieve this, it makes sense to transform the input data such that it falls in the range which our network can output.
                                    To this end,  we apply a min-max scaling functiion in which the original data (which  is in the 2 to -5 range) is
                                    first transformed to the 0 -1 range. Our output activation function is also set to sigmoid which outputs values in the same 0-1 range.
                                    The network is trained on this scaled data, and at test time we apply the same transformation to new test data and the reverse transform
                                    to the predicted result before it is visualized. Note that the transformation parameters are
                                    <a href=" https://sebastianraschka.com/faq/docs/scale-training-test.html" target="_blank" rel="noopener noreferrer"> computed only on train data</a>
                                    , before being applied at
                                   test time.

                            </div>
                                <div className=" flex20 flexwrapitem mr10">
                                    <div className="pb5 boldtext"> Model Training </div>
                                    Most approaches to anomaly detection (and there are many) begin by constructing a model of
                                        normal behaviour and then exploit this model to identify deviations from normal (anomalies or abnormal data).
                                    Here is how we can use an autoencoder to model normal behaviour. If you recall, an autoencoder learns to compress
                                    and reconstruct data. Notably this learned mapping is specific to the data type/distribution distribution of the training data.
                                    In other words an autoencoder trained using 15 px images of dogs is unlikely to correctly reconstruct 20px images of the surface
                                    of the moon.
                            </div>


                                <div className="border rad4 p10 " style={{ width: "300px", height: "300px" }}>
                                    Interactive replay of training run visualization
                            </div>
                            </div>

                        </div>

                        <div className="sectiontitle mt10 mb5"> Model Evaluation: Accuracy is NOT Enough </div>
                        <div className="">
                            <div className="flex">
                                <div className="flex6 lh10 mb10 pr10">
                                    Data for this problem is likely imbalanced. The number of anomalies we encounter is likely to be much smaller than normal data.
                                    Consider we have a bad classifiier that simply flags all our data points as normal, it would still have a high accuracy value.

                            </div>

                                <div className="border rad4 p10 flex4" style={{ height: "200px" }}>
                                    ROC curve and some metrics
                            </div>
                            </div>

                        </div>

                        <div className="sectiontitle mt10 mb10"> Effect of Model Parameters </div>
                        <div className="flex flexwrap">

                            <div className="flex3 flexwrapitem mr10">
                                <div className="flex6 lh10 mb10 pr10">
                                    <div className="pb5 boldtext"> Learning Rate </div>
                                    Data for this problem is likely imbalanced. The number of anomalies we encounter is likely to be much smaller than normal data.
                                    Consider we have a bad classifiier that simply flags all our data points as normal, it would still have a high accuracy value.

                                </div>


                            </div>

                            <div className="flex3 flexwrapitem  mr10">
                                <div className="flex6 lh10 mb10 pr10">
                                    <div className="pb5 boldtext"> Regularization </div>
                                    Data for this problem is likely imbalanced. The number of anomalies we encounter is likely to be much smaller than normal data.
                                    Consider we have a bad classifiier that simply flags all our data points as normal, it would still have a high accuracy value.

                                </div>


                            </div>

                            <div className="flex4 flexwrapitem  mr10">
                                <div className="flex6 lh10 mb10 pr10">
                                    <div className="pb5 boldtext"> Batch Size </div>
                                    Data for this problem is likely imbalanced. The number of anomalies we encounter is likely to be much smaller than normal data.
                                    Consider we have a bad classifiier that simply flags all our data points as normal, it would still have a high accuracy value.

                                </div>
                            </div>

                            <div className="flex4 flexwrapitem  mr10">
                                <div className="flex6 lh10 mb10 pr10">
                                    <div className="pb5 boldtext"> Abnormal Percentage </div>
                                    Data for this problem is likely imbalanced. The number of anomalies we encounter is likely to be much smaller than normal data.
                                    Consider we have a bad classifiier that simply flags all our data points as normal, it would still have a high accuracy value.

                                </div>
                            </div>
                        </div>


                        <div className="sectiontitle mt10 mb5"> Lottery Tickets: Winning Initializations </div>
                        <div className="">
                            <div className="flex">
                                <div className="flex6 lh10 mb10 pr10">
                                    Ever heard of a weird thing with neural networks called a lottery ticket?
                                        While the problem in this example is relatively too simple (140 features, not so complex patters)
                                    An observation of what happens each time the autoencoder is initialized can provide insights into the
                                    how luck some nerual network initializations can be.
                                    In essence, there are initializationsss that immeidately result in a high performance (good AUC) mpodel
                                    and require very littl
                                    while others are just plain bad.
                            </div>

                                <div className="border rad4 p10 flex4" style={{ height: "200px" }}>
                                    ROC curve and some metrics
                            </div>
                            </div>

                        </div>
                    </div>
                }






                <div>
                    {/* A VAE (an extension of an AE) can allow us generate sampled data without */}
                </div>





                <br />
                <br />
                <br />
                <br />
            </div>
        )
    }
}

export default Viz