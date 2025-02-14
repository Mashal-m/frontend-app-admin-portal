import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

import { logError } from '@edx/frontend-platform/logging';
import { getConfig } from '@edx/frontend-platform/config';
import { camelCaseObject } from '@edx/frontend-platform/utils';

import EcommerceApiService from '../../../data/services/EcommerceApiService';
import LicenseManagerApiService from '../../../data/services/LicenseManagerAPIService';
import SubsidyApiService from '../../../data/services/EnterpriseSubsidyApiService';

export const useEnterpriseOffers = ({ enablePortalLearnerCreditManagementScreen, enterpriseId }) => {
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canManageLearnerCredit, setCanManageLearnerCredit] = useState(false);

  dayjs.extend(isSameOrBefore);
  dayjs.extend(isSameOrAfter);

  useEffect(() => {
    setIsLoading(true);
    const fetchOffers = async () => {
      try {
        const [enterpriseSubsidyResponse, ecommerceApiResponse] = await Promise.all([
          SubsidyApiService.getSubsidyByCustomerUUID(enterpriseId, { subsidyType: 'learner_credit' }),
          EcommerceApiService.fetchEnterpriseOffers({
            isCurrent: true,
          }),
        ]);

        // If there are no subsidies in enterprise, fall back to the e-commerce API.
        let { results } = camelCaseObject(enterpriseSubsidyResponse.data);
        let source = 'subsidyApi';

        if (results.length === 0) {
          results = camelCaseObject(ecommerceApiResponse.data.results);
          source = 'ecommerceApi';
        }
        let activeSubsidyFound = false;
        if (results.length !== 0) {
          let subsidy = results[0];
          const offerData = [];
          let activeSubsidyData = {};
          for (let i = 0; i < results.length; i++) {
            subsidy = results[i];
            activeSubsidyFound = source === 'ecommerceApi'
              ? subsidy.isCurrent
              : subsidy.isActive;
            if (activeSubsidyFound === true) {
              activeSubsidyData = {
                id: subsidy.uuid || subsidy.id,
                name: subsidy.title || subsidy.displayName,
                start: subsidy.activeDatetime || subsidy.startDatetime,
                end: subsidy.expirationDatetime || subsidy.endDatetime,
                isCurrent: activeSubsidyFound,
              };
              offerData.push(activeSubsidyData);
              setCanManageLearnerCredit(true);
            }
          }
          setOffers(offerData);
        }
      } catch (error) {
        logError(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (getConfig().FEATURE_LEARNER_CREDIT_MANAGEMENT
      && enablePortalLearnerCreditManagementScreen) {
      fetchOffers();
    } else {
      setIsLoading(false);
    }
  }, [enablePortalLearnerCreditManagementScreen, enterpriseId]);

  return {
    isLoading,
    offers,
    canManageLearnerCredit,
  };
};

export const useCustomerAgreement = ({ enterpriseId }) => {
  const [customerAgreement, setCustomerAgreement] = useState();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomerAgreement = async () => {
      try {
        const response = await LicenseManagerApiService.fetchCustomerAgreementData({
          enterprise_customer_uuid: enterpriseId,
        });
        const { results } = camelCaseObject(response.data);
        if (results.length > 0) {
          setCustomerAgreement(results[0]);
        }
      } catch (error) {
        logError(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerAgreement();
  }, [enterpriseId]);

  return {
    customerAgreement,
    isLoading,
  };
};

export const useCoupons = (options) => {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        // We are more interested in the existence of coupons here rather than fetching all of them.
        const response = await EcommerceApiService.fetchCouponOrders(options);
        const { results } = camelCaseObject(response.data);
        setCoupons(results);
      } catch (error) {
        logError(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoupons();
  }, [options]);

  return {
    coupons,
    isLoading,
  };
};
