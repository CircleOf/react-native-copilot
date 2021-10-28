// @flow
import React, { Component } from 'react';
import { Animated, Easing, NativeModules, Modal, StatusBar, Platform } from 'react-native';
import Tooltip from './Tooltip';
import styles, { MARGIN } from './style';
import type { SvgMaskPathFn } from '../types';
import ViewMask from './ViewMask';

const isFunction = value => value && (Object.prototype.toString.call(value) === '[object Function]' || typeof value === 'function' || value instanceof Function);

type Props = {
  stop: () => void,
  next: () => void,
  prev: () => void,
  currentStep: ?Step,
  visible: boolean,
  isFirstStep: boolean,
  isLastStep: boolean,
  easing: ?func,
  animationDuration: ?number,
  tooltipComponent: ?React$Component,
  maskComponent: ?React$Component,
  tooltipStyle?: Object | (step: Step) => Object,
  animated: boolean | (step: Step) => boolean,
  androidStatusBarVisible: boolean,
  backdropColor: string,
  labels: Object,
  svgMaskPath?: SvgMaskPathFn,
  stopOnOutsideClick?: boolean,
  stepCount: number,
  steps: Step[]
};

type State = {
  tooltip: Object,
  arrow: Object,
  animatedValues: Object,
  notAnimated: boolean,
  layout: ?{
    width: number,
    height: number,
  },
};

class CopilotModal extends Component<Props, State> {
  static defaultProps = {
    easing: Easing.elastic(0.7),
    animationDuration: 400,
    tooltipComponent: Tooltip,
    maskComponent: ViewMask,
    tooltipStyle: {},
    // If animated was not specified, rely on the default overlay type
    animated: typeof NativeModules.RNSVGSvgViewManager !== 'undefined',
    androidStatusBarVisible: false,
    backdropColor: 'rgba(0, 0, 0, 0.4)',
    labels: {},
    stopOnOutsideClick: false,
    stepCount: 1,
    tooltipVerticalPosition: 'center',
    tooltipHorizontalPosition: 'center',
  };

  state = {
    tooltip: {},
    animatedValues: {
      top: new Animated.Value(0),
    },
    animated: false,
    containerVisible: false,
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.visible === true && this.props.visible === false) {
      this.reset();
    }
  }

  layout = {
    width: 0,
    height: 0,
  }

  handleLayoutChange = ({ nativeEvent: { layout } }) => {
    this.layout = layout;
  }

  measure(): Promise {
    if (typeof __TEST__ !== 'undefined' && __TEST__) { // eslint-disable-line no-undef
      return new Promise(resolve => resolve({
        x: 0, y: 0, width: 0, height: 0,
      }));
    }


    return new Promise((resolve) => {
      const setLayout = () => {
        if (this.layout.width !== 0) {
          resolve(this.layout);
        } else {
          requestAnimationFrame(setLayout);
        }
      };
      setLayout();
    });
  }

  async _animateMove(obj = {}): void {
    const layout = await this.measure();
    if (!this.props.androidStatusBarVisible && Platform.OS === 'android') {
      obj.top -= StatusBar.currentHeight; // eslint-disable-line no-param-reassign
    }

    const center = {
      x: obj.left + (obj.width / 2),
      y: obj.top + (obj.height / 2),
    };

    const relativeToLeft = center.x;
    const relativeToTop = center.y;
    const relativeToBottom = Math.abs(center.y - layout.height);
    const relativeToRight = Math.abs(center.x - layout.width);

    const verticalPosition = relativeToBottom > relativeToTop ? 'bottom' : 'top';
    const horizontalPosition = relativeToLeft > relativeToRight ? 'left' : 'right';

    const tooltip = {};

    if (verticalPosition === 'bottom') {
      tooltip.top = obj.top + obj.height + MARGIN;
    } else {
      tooltip.bottom = layout.height - (obj.top - MARGIN);
    }

    if (horizontalPosition === 'left') {
      tooltip.right = Math.max(layout.width - (obj.left + obj.width), 0);
      tooltip.right = tooltip.right === 0 ? tooltip.right + MARGIN : tooltip.right;
      // tooltip.maxWidth = layout.width - tooltip.right - MARGIN;
    } else {
      tooltip.left = Math.max(obj.left, 0);
      tooltip.left = tooltip.left === 0 ? tooltip.left + MARGIN : tooltip.left;
      // tooltip.maxWidth = layout.width - tooltip.left - MARGIN;
    }

    const animate = {
      top: obj.top,
    };

    if (this.state.animated) {
      Animated
        .parallel(Object.keys(animate)
          .map(key => Animated.timing(this.state.animatedValues[key], {
            toValue: animate[key],
            duration: this.props.animationDuration,
            easing: this.props.easing,
            useNativeDriver: false,
          })))
        .start();
    } else {
      Object.keys(animate).forEach((key) => {
        this.state.animatedValues[key].setValue(animate[key]);
      });
    }

    const animated = isFunction(this.props.animated)
      ? this.props.animated(this.props.currentStep)
      : this.props.animated;

    this.setState({
      tooltip,
      layout,
      animated,
      size: {
        x: obj.width,
        y: obj.height,
      },
      position: {
        x: Math.floor(Math.max(obj.left, 0)),
        y: Math.floor(Math.max(obj.top, 0)),
      },
    });
  }

  animateMove(obj = {}): void {
    return new Promise((resolve) => {
      this.setState(
        { containerVisible: true },
        () => {
          requestAnimationFrame(async () => {
            await this._animateMove(obj);
            resolve();
          });
        },
      );
    });
  }

  reset(): void {
    this.setState({
      animated: false,
      containerVisible: false,
      layout: undefined,
    });
  }

  handleNext = () => {
    this.props.next();
  }

  handlePrev = () => {
    this.props.prev();
  }

  handleStop = () => {
    this.reset();
    this.props.stop();
  }

  handleMaskClick = () => {
    if (this.props.stopOnOutsideClick) {
      this.handleStop();
    }
  };

  renderTooltip() {
    const {
      stepCount,
      tooltipComponent: TooltipComponent,
      steps,
    } = this.props;

    const tooltipStyle = isFunction(this.props.tooltipStyle)
      ? this.props.tooltipStyle(this.props.currentStep, this.state.position, this.state.size)
      : this.props.tooltipStyle;

    return (
      <Animated.View key="tooltip" style={[styles.tooltip, this.state.tooltip, tooltipStyle]}>
        <TooltipComponent
          steps={steps}
          isFirstStep={this.props.isFirstStep}
          isLastStep={this.props.isLastStep}
          currentStep={this.props.currentStep}
          handleNext={this.handleNext}
          handlePrev={this.handlePrev}
          handleStop={this.handleStop}
          labels={this.props.labels}
          stepCount={stepCount}
        />
      </Animated.View>
    );
  }

  render() {
    const containerVisible = this.state.containerVisible || this.props.visible;
    const contentVisible = this.state.layout && containerVisible;

    const { maskComponent: MaskComponent } = this.props;

    return (
      <Modal animated animationType="fade" visible={containerVisible} transparent>
        <MaskComponent
          animated={this.state.animated}
          visible={contentVisible}
          layout={this.state.layout}
          style={[styles.overlayContainer]}
          size={this.state.size}
          position={this.state.position}
          easing={this.props.easing}
          animationDuration={this.props.animationDuration}
          backdropColor={this.props.backdropColor}
          svgMaskPath={this.props.svgMaskPath}
          onClick={this.handleMaskClick}
          currentStep={this.props.currentStep}
        >
          <Animated.View
            style={[styles.container, { backgroundColor: this.props.backdropColor }]}
            onLayout={this.handleLayoutChange}
          >
            {contentVisible && this.renderTooltip()}
          </Animated.View>
        </MaskComponent>
      </Modal>
    );
  }
}

export default CopilotModal;
