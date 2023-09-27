sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Sorter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/FilterType",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (Controller, JSONModel, Sorter, Filter, FilterOperator, FilterType, MessageToast, MessageBox) {
	"use strict";

	return Controller.extend("sap.ui.core.tutorial.odatav4.controller.App", {

		/**
		 *  Hook for initializing the controller
		 */
		onInit: function () {
			//Get message manager and message model
			var oMessageManager = sap.ui.getCore().getMessageManager(),
				oMessageModel = oMessageManager.getMessageModel(),
				//Do Binding on messagemodel
				oMessageModelBinding = oMessageModel.bindList(
					"/", undefined, [], new Filter("technical",
						FilterOperator.EQ, true)
				);
			var oJSONData = {
				busy: false,
				hasUIChanges: false,
				userNameEmpty: true
			},
				oModel = new JSONModel(oJSONData);
			//set model appview
			this.getView().setModel(oModel, "appView");
			//set model message
			this.getView().setModel(oMessageModel, "message");
			this._iOrder = 0;

			oMessageModelBinding.attachChange(this._onMessageBindingChange, this);
			this._bTechnicalErrors = false;
		},
		onCreate: function () {
			//Get List
			var oList = this.byId("peopleList");
			//Get Binding
			var oBinding = oList.getBinding("items");
			debugger;
			//Create Context
			var oContext = oBinding.create({
				"UserName": "",
				"FirstName": "",
				"LastName": "",
				"Age": "18"
			});
			//Disable few controls (search,sort,save)
			this._setUIChanges();
			//this.getView().getModel("appView").setProperty("/userNameEmpty", false);
			oList.getItems().some(function (oItem) {
				if (oItem.getBindingContext() === oContext) {
					oItem.focus();
					oItem.setSelected(true);
					return true;
				}
			});
		},
		onResetDataSource: function () {
			var oModel = this.getView().getModel(),
				oOperation = oModel.bindContext("/ResetDataSource(...)");

			oOperation.execute().then(function () {
				oModel.refresh();
				MessageToast.show(this._getText("sourceResetSuccessMessage"));
			}.bind(this), function (oError) {
				MessageBox.error(oError.message);
			}
			);
		},
		onSave: function () {
			//Get default oData V4 model
			var oModel = this.getView().getModel();
			this._setBusy(true);
			var fnResolved = function () {
				this._setBusy(false);
				MessageToast.show(this._getText("changesSentMessage"));
				this._setUIChanges(false);
			}.bind(this);
			var fnRejected = function (oError) {
				this._setBusy(false);
				this._setUIChanges(false);
				MessageBox.error(oError.message);
			}.bind(this);
			oModel.submitBatch("peopleGroup").then(fnResolved, fnRejected);
			this._bTechnicalErrors = false;
		},
		onDelete: function (oEvent) {
			var oContext,
				oPeopleList = this.byId("peopleList"),
				oSelected = oPeopleList.getSelectedItem(),
				sUserName;
			if (oSelected) {
				oContext = oSelected.getBindingContext();
				sUserName = oContext.getProperty("UserName");
				oContext.delete().then(
					function () {
						MessageToast.show(this._getText("deletionSuccessMessage", sUserName));
					}.bind(this),
					function (oError) {
						if (oContext === oPeopleList.getSelectedItem().getBindingContext()) {
							this._setDetailArea(oContext);
						}
						this._setUIChanges();
						if (oError.canceled) {
							MessageToast.show(this._getText("deletionRestoredMessage", sUserName));
							return;
						}
						MessageBox.error(oError.message + ": " + sUserName);
					}.bind(this));
				this._setDetailArea();
			}
		},
		onRefresh: function (oEvent) {
			var oBinding = this.byId("peopleList").getBinding("items");
			if (oBinding.hasPendingChanges()) {

				sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
					MessageBox.error(this._getText("refreshNotPossibleMessage"));
					return;
				}.bind(this));

			}
			//Refresh
			oBinding.refresh();

			sap.ui.require(["sap/m/MessageToast"], function (MessageToast) {
				MessageToast.show(this._getText("refreshSuccessMessage"));
			}.bind(this));
		},
		onSearch: function (oEvent) {
			var sValue = this.getView().byId("searchField").getValue(),
				oFilter = new Filter("LastName", FilterOperator.Contains, sValue),
				oBinding = this.byId("peopleList").getBinding("items");
			oBinding.filter(oFilter, FilterType.Application)
		},
		onSort: function (oEvent) {
			//Create sort states
			var aStates = ["undefined", "asc", "desc"],
				sMessage,
				//Sort texts
				aStateTexts = ["sortNone", "sortAscending", "sortDescending"];
			//Find index for sort states
			this._iOrder = (this._iOrder + 1) % aStates.length;
			//Read sort state
			var sOrder = aStates[this._iOrder];
			//Apply sort state into Items binding on Table
			this.getView().byId("peopleList").getBinding("items").sort(
				sOrder && new Sorter("LastName", sOrder === "desc"));
			//Read message for sort texts
			sMessage = this._getText("sortMessage",
				[this._getText(aStateTexts[this._iOrder])]);
			//Show message
			sap.ui.require(["sap/m/MessageToast"],
				function (MessageToast) {
					MessageToast.show(sMessage);
				}.bind(this)

			);
		},
		onResetChanges: function () {
			this.byId("peopleList").getBinding("items").resetChanges();
			this._bTechnicalErrors = false;
			this._setUIChanges();
		},
		onInputChange: function (oEvent) {
			if (oEvent.getParameter("escPressed")) {
				this._setUIChanges();
			}
			else {
				this._setUIChanges(true);
				if (oEvent.getSource().getParent().getBindingContext().getProperty("UserName")) {
					this.getView().getModel("appView").setProperty("/userNameEmpty", false);
				}
			}
		},
		onSelectionChange: function (oEvent) {
			this._setDetailArea(oEvent.getParameter("listItem").getBindingContext());
		},
		//Private Methods
		_getText: function (sTextId, aArgs) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sTextId, aArgs);
		},
		_setUIChanges: function (bHasUIChanges) {

			if (this._bTechnicalErrors) {
				// If there is currently a technical error, then force 'true'.
				bHasUIChanges = true;
			}
			else if (bHasUIChanges === undefined) {
				bHasUIChanges = this.getView().getModel().hasPendingChanges();
			}
			var oModel = this.getView().getModel("appView");
			oModel.setProperty("/hasUIChanges", bHasUIChanges);

		},
		_setBusy: function (bIsBusy) {
			this.getView().getModel("appView").setProperty("/busy", bIsBusy);
		},
		_onMessageBindingChange: function (oEvent) {
			var aContexts = oEvent.getSource().getContexts(),
				aMessages,
				bMessageOpen = false;

			if (bMessageOpen || !aContexts.length) {
				return;
			}
			// Extract and remove the technical messages
			aMessages = aContexts.map(function (oContext) {
				return oContext.getObject();
			});
			sap.ui.getCore().getMessageManager().removeMessages(aMessages);
			this._setUIChanges(true);
			this._bTechnicalErrors = true;
			MessageBox.error(aMessages[0].message, {
				id: "serviceErrorMessageBox",
				onClose: function () {
					bMessageOpen = false;
				}
			});

			bMessageOpen = true;
		},
		_setDetailArea: function (oUserContext) {
			debugger;
			var oDetailArea = this.byId("detailArea"),
			oLayout = this.byId("defaultLayout"),
			oOldContext,
			oSearchField = this.byId("searchField");

	            if (!oDetailArea) {
			return; // do nothing when running within view destruction
		  }
		  
		  oOldContext = oDetailArea.getBindingContext();
		  if (oOldContext) {
			oOldContext.setKeepAlive(false);
		      }
		      if (oUserContext) {
			oUserContext.setKeepAlive(true,
			    // hide details if kept entity was refreshed but does not exists any more
			    this._setDetailArea.bind(this));
	    
		      } 
                              oSearchField.setWidth(oUserContext ? "40%" : "20%");
			oDetailArea.setBindingContext(oUserContext || null);
	             // resize view
            oDetailArea.setVisible(!!oUserContext);
            oLayout.setSize(oUserContext ? "60%" : "100%");
            oLayout.setResizable(!!oUserContext);
            		
		}

	});
});
